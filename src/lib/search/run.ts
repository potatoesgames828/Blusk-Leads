import type { BusinessData } from "../business";
import { applyCredit, InsufficientCreditsError } from "../credits";
import type { Sql } from "../db";
import { OFFER_FILTERS, type OfferFilter } from "../filters";
import { matchesExcludedNiche } from "../niches";
import { phoneHash } from "../phone";
import { getLeadProvider, ProviderError, type LeadProvider } from "../providers";
import { scoreBusiness, temperatureOf } from "../score/engine";
import { getAppSettings } from "../settings";

export const MAX_PAGES_PER_SEARCH = 3; // Limite do Google: 60 resultados por consulta.
const STALE_MINUTES = 10;

export interface CreateSearchInput {
  nicho: string;
  cidade: string | null;
  uf: string | null;
  filtro: OfferFilter;
  pedidos: number;
}

export class SearchInputError extends Error {}

/**
 * Cria a busca e RESERVA os créditos (débito no extrato). A execução vem depois, em
 * runSearch; ao final, o que não foi entregue é estornado. Assim:
 *  - busca com erro não custa nada;
 *  - busca parcial cobra só os entregues;
 *  - lead repetido, bloqueado ou de nicho excluído nunca é contado como entregue.
 */
export async function createSearch(db: Sql, userId: string, workspaceId: string, input: CreateSearchInput): Promise<string> {
  await recoverStaleSearches(db);
  const nicho = input.nicho.trim();
  if (nicho.length < 2 || nicho.length > 80) throw new SearchInputError("Informe um nicho entre 2 e 80 caracteres.");
  if (!Number.isInteger(input.pedidos) || input.pedidos < 1 || input.pedidos > 60) {
    throw new SearchInputError("Peça entre 1 e 60 leads por busca.");
  }
  if (!(input.filtro in OFFER_FILTERS)) throw new SearchInputError("Filtro inválido.");

  const [ws] = await db<{ plano: string }[]>`select plano from workspaces where id = ${workspaceId}`;
  if (!ws) throw new SearchInputError("Conta não encontrada.");
  // No teste grátis a busca é no Brasil todo; escolher cidade é recurso do plano pago.
  const cidade = ws.plano === "teste" ? null : input.cidade?.trim() || null;
  const uf = cidade ? input.uf?.trim().toUpperCase() || null : null;

  const settings = await getAppSettings(db);
  const custo = settings.creditosPorLead.brasil;

  return db.begin(async (tx) => {
    const [s] = await tx<{ id: string }[]>`
      insert into searches (workspace_id, user_id, nicho, cidade, uf, modalidade, filtro_oferta, pedidos, creditos_por_lead)
      values (${workspaceId}, ${userId}, ${nicho}, ${cidade}, ${uf}, 'brasil', ${input.filtro}, ${input.pedidos}, ${custo})
      returning id`;
    try {
      await applyCredit(tx, {
        workspaceId,
        delta: -input.pedidos * custo,
        tipo: "reserva_busca",
        motivo: `Reserva para busca "${nicho}"${cidade ? ` em ${cidade}` : " no Brasil"} (${input.pedidos} leads)`,
        key: `search:${s!.id}:reserva`,
        refTipo: "search",
        refId: s!.id,
        actorId: userId,
      });
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        throw new SearchInputError("Você não tem créditos suficientes para essa quantidade de leads.");
      }
      throw err;
    }
    return s!.id;
  }) as Promise<string>;
}

type DiscardReason = "repetido" | "bloqueado" | "nicho_excluido" | "fora_do_filtro" | "reservado" | "fechado";

/** Executa a busca. Seguro para chamar mais de uma vez: só roda se ainda estiver na fila. */
export async function runSearch(db: Sql, searchId: string, provider: LeadProvider = getLeadProvider()): Promise<void> {
  const [search] = await db<
    { id: string; workspace_id: string; nicho: string; cidade: string | null; uf: string | null; filtro_oferta: OfferFilter; pedidos: number }[]
  >`update searches set status = 'rodando', started_at = now()
    where id = ${searchId} and status = 'na_fila'
    returning id, workspace_id, nicho, cidade, uf, filtro_oferta, pedidos`;
  if (!search) return;

  const descartados: Record<DiscardReason, number> = {
    repetido: 0, bloqueado: 0, nicho_excluido: 0, fora_do_filtro: 0, reservado: 0, fechado: 0,
  };
  let entregues = 0;
  let chamadas = 0;
  let aviso: string | null = null;

  try {
    const settings = await getAppSettings(db);
    const [ws] = await db<{ ofertas: string[]; nichos_excluidos: string[] }[]>`
      select ofertas, nichos_excluidos from workspace_settings where workspace_id = ${search.workspace_id}`;
    const weightsRows = await db<{ regra: string; peso: number }[]>`
      select regra, peso from workspace_score_weights where workspace_id = ${search.workspace_id}`;
    const weights = Object.fromEntries(weightsRows.map((r) => [r.regra, r.peso]));
    const ofertas = ws?.ofertas ?? [];
    const excluidos = ws?.nichos_excluidos ?? [];
    const filtro = OFFER_FILTERS[search.filtro_oferta];

    let pageToken: string | null = null;
    for (let page = 0; page < MAX_PAGES_PER_SEARCH && entregues < search.pedidos; page++) {
      if (!(await takeProviderQuota(db, provider.id))) {
        aviso = "O limite diário de consultas do sistema foi atingido. Você não pagou pelos leads que faltaram; tente de novo amanhã.";
        break;
      }
      chamadas++;
      let result;
      try {
        result = await provider.searchPage({ nicho: search.nicho, cidade: search.cidade, uf: search.uf }, pageToken);
        await db`insert into api_usage (workspace_id, servico, operacao) values (${search.workspace_id}, 'places', 'searchText')`;
      } catch (err) {
        await db`insert into api_usage (workspace_id, servico, operacao, sucesso) values (${search.workspace_id}, 'places', 'searchText', false)`;
        throw err;
      }

      for (const b of result.businesses) {
        if (entregues >= search.pedidos) break;
        const reason = await tryDeliver(db, search, b, { filtro, excluidos, ofertas, weights, diasExclusividade: settings.diasExclusividade, diasCache: settings.diasCacheGoogle });
        if (reason) descartados[reason]++;
        else entregues++;
      }
      pageToken = result.nextPageToken;
      if (!pageToken) break;
    }

    if (entregues < search.pedidos && !aviso) {
      aviso = `Encontramos ${entregues} lead${entregues === 1 ? "" : "s"} novo${entregues === 1 ? "" : "s"} de ${search.pedidos} pedidos. Você só pagou pelos entregues. Tente outro nicho, cidade ou filtro.`;
    }
    await finalizeSearch(db, searchId, entregues === search.pedidos ? "concluida" : "parcial", { descartados, aviso, chamadas });
  } catch (err) {
    const code = err instanceof ProviderError ? err.code : "interno";
    const msg = err instanceof ProviderError ? err.message : "Erro interno ao buscar leads";
    if (!(err instanceof ProviderError)) console.error(JSON.stringify({ evento: "busca_erro", searchId, erro: String(err) }));
    const delivered = await countDelivered(db, searchId);
    await finalizeSearch(db, searchId, delivered > 0 ? "parcial" : "erro", {
      descartados,
      aviso: delivered > 0 ? `A busca foi interrompida por um erro depois de ${delivered} leads. Você só pagou pelos entregues.` : null,
      chamadas,
      erro: { codigo: code, msg },
    });
  }
}

interface DeliverCtx {
  filtro: (typeof OFFER_FILTERS)[OfferFilter];
  excluidos: string[];
  ofertas: string[];
  weights: Record<string, number>;
  diasExclusividade: number;
  diasCache: number;
}

async function tryDeliver(
  db: Sql,
  search: { id: string; workspace_id: string },
  b: BusinessData,
  ctx: DeliverCtx,
): Promise<DiscardReason | null> {
  if (b.statusFuncionamento === "CLOSED_PERMANENTLY") return "fechado";
  if (matchesExcludedNiche([b.categoria, ...b.tipos, b.nome], ctx.excluidos)) return "nicho_excluido";
  if (!ctx.filtro.aplica(b)) return "fora_do_filtro";

  const hash = b.telefoneE164 ? phoneHash(b.telefoneE164) : null;
  const [blocked] = await db`
    select 1 from blocked_businesses
    where ativo and ((provider = ${b.provider} and provider_id = ${b.providerId}) or (${hash}::text is not null and telefone_hash = ${hash}))
    limit 1`;
  if (blocked) return "bloqueado";

  const receipt = scoreBusiness({ business: b, ofertas: ctx.ofertas }, ctx.weights);

  try {
    return await insertLead(db, search, b, hash, receipt, ctx);
  } catch (err) {
    // Corrida com outra busca simultânea: as restrições do banco decidem quem fica com o lead.
    const code = (err as { code?: string }).code;
    if (code === "23505") return "repetido";
    if (code === "23P01") return "reservado";
    throw err;
  }
}

async function insertLead(
  db: Sql,
  search: { id: string; workspace_id: string },
  b: BusinessData,
  hash: string | null,
  receipt: ReturnType<typeof scoreBusiness>,
  ctx: DeliverCtx,
): Promise<DiscardReason | null> {
  return db.begin(async (tx) => {
    const [biz] = await tx<{ id: string }[]>`
      insert into businesses (provider, provider_id, nome, categoria, tipos, endereco, cidade, uf, pais, telefone_e164,
        telefone_hash, whatsapp_provavel, site, rede_social, nota, avaliacoes, horario, lat, lng, maps_url, email_publico,
        status_funcionamento, coletado_em, expira_em)
      values (${b.provider}, ${b.providerId}, ${b.nome}, ${b.categoria}, ${b.tipos}, ${b.endereco}, ${b.cidade}, ${b.uf},
        ${b.pais}, ${b.telefoneE164}, ${hash}, ${b.whatsappProvavel}, ${b.site}, ${b.redeSocial}, ${b.nota}, ${b.avaliacoes},
        ${b.horario ? tx.json(b.horario) : null}, ${b.lat}, ${b.lng}, ${b.mapsUrl}, ${b.emailPublico}, ${b.statusFuncionamento},
        now(), ${b.provider === "google_places" ? tx`now() + make_interval(days => ${ctx.diasCache})` : null})
      on conflict (provider, provider_id) do update set
        nome = excluded.nome, categoria = excluded.categoria, tipos = excluded.tipos, endereco = excluded.endereco,
        cidade = excluded.cidade, uf = excluded.uf, telefone_e164 = excluded.telefone_e164,
        telefone_hash = excluded.telefone_hash, whatsapp_provavel = excluded.whatsapp_provavel, site = excluded.site,
        rede_social = excluded.rede_social, nota = excluded.nota, avaliacoes = excluded.avaliacoes,
        horario = excluded.horario, maps_url = excluded.maps_url, status_funcionamento = excluded.status_funcionamento,
        coletado_em = now(), expira_em = excluded.expira_em
      returning id`;

    const [already] = await tx`select 1 from leads where workspace_id = ${search.workspace_id} and business_id = ${biz!.id}`;
    if (already) return "repetido" as const;

    // Bloqueia a linha do negócio para que duas buscas simultâneas não reservem o mesmo lead.
    await tx`select id from businesses where id = ${biz!.id} for update`;
    const [reserved] = await tx`
      select 1 from lead_reservations
      where business_id = ${biz!.id} and workspace_id <> ${search.workspace_id} and reservado_ate > now()`;
    if (reserved) return "reservado" as const;

    await tx`
      insert into lead_reservations (business_id, workspace_id, reservado_ate)
      values (${biz!.id}, ${search.workspace_id}, now() + make_interval(days => ${ctx.diasExclusividade}))`;
    const [lead] = await tx<{ id: string }[]>`
      insert into leads (workspace_id, business_id, search_id, origem, score, score_recibo, temperatura)
      values (${search.workspace_id}, ${biz!.id}, ${search.id}, 'busca', ${receipt.total}, ${tx.json(receipt as never)}, ${temperatureOf(receipt.total)})
      returning id`;
    await tx`insert into lead_events (lead_id, workspace_id, tipo, dados) values (${lead!.id}, ${search.workspace_id}, 'criado', ${tx.json({ origem: "busca", search_id: search.id })})`;
    return null;
  }) as Promise<DiscardReason | null>;
}

async function countDelivered(db: Sql, searchId: string): Promise<number> {
  const [r] = await db<{ n: number }[]>`select count(*)::int as n from leads where search_id = ${searchId}`;
  return r?.n ?? 0;
}

/**
 * Fecha a busca e estorna o que não foi entregue. A contagem de entregues vem do banco
 * (não da memória), então o estorno fica correto mesmo após uma queda no meio da busca.
 */
export async function finalizeSearch(
  db: Sql,
  searchId: string,
  status: "concluida" | "parcial" | "erro",
  extra: { descartados?: object; aviso?: string | null; chamadas?: number; erro?: { codigo: string; msg: string } },
): Promise<void> {
  await db.begin(async (tx) => {
    const [s] = await tx<{ workspace_id: string; pedidos: number; creditos_por_lead: number; nicho: string; user_id: string }[]>`
      select workspace_id, pedidos, creditos_por_lead, nicho, user_id from searches where id = ${searchId} for update`;
    if (!s) return;
    const [{ n: entregues }] = (await tx<{ n: number }[]>`select count(*)::int as n from leads where search_id = ${searchId}`) as [{ n: number }];
    const naoEntregues = Math.max(0, s.pedidos - entregues);
    if (naoEntregues > 0) {
      await applyCredit(tx, {
        workspaceId: s.workspace_id,
        delta: naoEntregues * s.creditos_por_lead,
        tipo: "estorno_busca",
        motivo:
          status === "erro"
            ? `Estorno integral: a busca "${s.nicho}" falhou`
            : `Estorno de ${naoEntregues} lead${naoEntregues === 1 ? "" : "s"} não entregue${naoEntregues === 1 ? "" : "s"} na busca "${s.nicho}"`,
        key: `search:${searchId}:estorno`,
        refTipo: "search",
        refId: searchId,
      });
    }
    await tx`
      update searches set status = ${status}, entregues = ${entregues}, finished_at = now(),
        descartados = ${tx.json((extra.descartados ?? {}) as never)}, aviso = ${extra.aviso ?? null},
        chamadas_api = ${extra.chamadas ?? 0}, erro_codigo = ${extra.erro?.codigo ?? null}, erro_msg = ${extra.erro?.msg ?? null}
      where id = ${searchId}`;
  });
}

/** Buscas presas (queda do servidor) são encerradas e estornadas automaticamente. */
export async function recoverStaleSearches(db: Sql): Promise<number> {
  const stale = await db<{ id: string }[]>`
    select id from searches where status in ('na_fila', 'rodando')
    and created_at < now() - make_interval(mins => ${STALE_MINUTES})`;
  for (const s of stale) {
    await finalizeSearch(db, s.id, "erro", { erro: { codigo: "timeout", msg: "A busca não terminou a tempo" } });
  }
  return stale.length;
}

/** Teto diário de chamadas ao provedor, somando todas as contas. */
async function takeProviderQuota(db: Sql, provider: string): Promise<boolean> {
  const limite = Number(process.env.PROVIDER_DAILY_CALL_LIMIT ?? 500);
  const [row] = await db<{ usadas: number }[]>`
    insert into provider_quotas (provider, dia, limite, usadas) values (${provider}, current_date, ${limite}, 1)
    on conflict (provider, dia) do update set usadas = provider_quotas.usadas + 1, limite = ${limite}
      where provider_quotas.usadas < provider_quotas.limite
    returning usadas`;
  return Boolean(row);
}
