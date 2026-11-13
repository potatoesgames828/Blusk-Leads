import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, TempBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { LOST_REASONS } from "@/lib/crm";
import { sql, withUser } from "@/lib/db";
import { formatBrPhone } from "@/lib/phone";
import type { ScoreReceipt } from "@/lib/score/engine";
import { refreshBusinessIfExpired } from "@/lib/search/refresh";
import { FollowupControl, InfoForm, NoteForm, StageControl } from "./lead-controls";
import { MessageComposer } from "./message-composer";

export const metadata = { title: "Lead" };

const EVENT_LABEL: Record<string, string> = {
  criado: "Lead encontrado na busca",
  enviado_crm: "Enviado para o CRM",
  etapa: "Mudou de etapa",
  mensagem_gerada: "Mensagens geradas",
  mensagem_enviada: "Mensagem aberta para envio",
  followup: "Lembrete agendado",
  followup_concluido: "Lembrete concluído",
  nota: "Nota adicionada",
  descartado: "Descartado",
};

const NA = <span className="text-ink-500">não disponível</span>;
const fmtNota = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const [bizRef] = await withUser(user.id, (tx) => tx<{ business_id: string }[]>`select business_id from leads where id = ${id} and bloqueado_em is null`);
  if (!bizRef) notFound();
  await refreshBusinessIfExpired(sql(), bizRef.business_id);

  const data = await withUser(user.id, async (tx) => {
    const [lead] = await tx<
      {
        id: string; score: number; temperatura: "quente" | "morno" | "frio"; score_recibo: ScoreReceipt; stage_id: string | null; no_crm: boolean;
        descartado_em: Date | null; motivo_perda: string | null; motivo_perda_texto: string | null; valor_estimado_centavos: number | null;
        nome: string; categoria: string | null; endereco: string | null; cidade: string | null; uf: string | null; telefone_e164: string | null;
        whatsapp_provavel: boolean; site: string | null; rede_social: string | null; nota: number | null; avaliacoes: number | null;
        horario: string[] | null; maps_url: string | null; email_publico: string | null; provider: string; coletado_em: Date;
      }[]
    >`
      select l.id, l.score, l.temperatura, l.score_recibo, l.stage_id, l.no_crm, l.descartado_em, l.motivo_perda, l.motivo_perda_texto,
        l.valor_estimado_centavos::int as valor_estimado_centavos, b.nome, b.categoria, b.endereco, b.cidade, b.uf, b.telefone_e164,
        b.whatsapp_provavel, b.site, b.rede_social, b.nota::float as nota, b.avaliacoes, b.horario, b.maps_url, b.email_publico, b.provider, b.coletado_em
      from leads l join businesses b on b.id = l.business_id where l.id = ${id}`;
    const stages = await tx<{ id: string; nome: string; tipo: string }[]>`select id, nome, tipo from pipeline_stages order by ordem`;
    const followups = await tx<{ id: string; vence_em: string; origem: string }[]>`
      select id, to_char(vence_em, 'YYYY-MM-DD') as vence_em, origem from followups where lead_id = ${id} and concluido_em is null order by vence_em`;
    const events = await tx<{ id: string; tipo: string; de: string | null; para: string | null; dados: Record<string, unknown>; created_at: Date }[]>`
      select id, tipo, de, para, dados, created_at from lead_events where lead_id = ${id} order by created_at desc limit 50`;
    const notes = await tx<{ id: string; texto: string; created_at: Date }[]>`select id, texto, created_at from lead_notes where lead_id = ${id} order by created_at desc`;
    const tags = await tx<{ nome: string }[]>`select t.nome from lead_tags lt join tags t on t.id = lt.tag_id where lt.lead_id = ${id} order by t.nome`;
    return { lead: lead!, stages, followups, events, notes, tags: tags.map((t) => t.nome) };
  });
  const { lead, stages, followups, events, notes, tags } = data;
  const r = lead.score_recibo;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={lead.no_crm ? "/crm" : "/buscar"} className="text-sm font-semibold text-brand-700">
        ← {lead.no_crm ? "CRM" : "Buscar"}
      </Link>
      <div className="mb-4 mt-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{lead.nome}</h1>
          <p className="text-ink-600">{[lead.categoria, lead.cidade && `${lead.cidade}${lead.uf ? ` - ${lead.uf}` : ""}`].filter(Boolean).join(" · ")}</p>
        </div>
        <TempBadge temp={lead.temperatura} score={lead.score} />
      </div>
      {lead.descartado_em && <p className="mb-3 rounded-xl bg-ink-100 px-3 py-2 text-sm">Este lead foi descartado.</p>}
      {lead.motivo_perda && (
        <p className="mb-3 rounded-xl bg-ink-100 px-3 py-2 text-sm">
          Perdido: {LOST_REASONS.find((x) => x.id === lead.motivo_perda)?.nome}
          {lead.motivo_perda_texto && ` — ${lead.motivo_perda_texto}`}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 text-lg font-bold">Abordar</h2>
            <MessageComposer leadId={lead.id} telefone={lead.telefone_e164} nomeNegocio={lead.nome} emailPublico={lead.email_publico} />
          </Card>

          <Card>
            <h2 className="text-lg font-bold">Por que a nota {lead.score}?</h2>
            <p className="mb-3 text-sm text-ink-600">Recibo da pontuação (regras v{r.versao}). Você pode mudar os pesos em Ajustes.</p>
            <table className="w-full text-[15px]">
              <caption className="sr-only">Recibo da nota do lead</caption>
              <tbody className="divide-y divide-ink-100">
                <tr>
                  <td className="py-2">Pontuação inicial</td>
                  <td className="py-2 text-right font-semibold tabular-nums">{r.base}</td>
                </tr>
                {r.regras.map((l) => (
                  <tr key={l.chave}>
                    <td className="py-2">
                      <span className="font-semibold">{l.nome}</span>
                      <span className="block text-sm text-ink-600">{l.motivo}</span>
                    </td>
                    <td className={`py-2 text-right font-semibold tabular-nums ${l.pontos >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {l.pontos > 0 ? `+${l.pontos}` : l.pontos}
                    </td>
                  </tr>
                ))}
                {r.ajuste_ia && (
                  <tr>
                    <td className="py-2">Ajuste da IA<span className="block text-sm text-ink-600">{r.ajuste_ia.motivo}</span></td>
                    <td className="py-2 text-right font-semibold tabular-nums">{r.ajuste_ia.pontos}</td>
                  </tr>
                )}
                {r.corte !== 0 && (
                  <tr>
                    <td className="py-2 text-ink-600">Ajuste para ficar entre 0 e 100</td>
                    <td className="py-2 text-right font-semibold tabular-nums">{r.corte > 0 ? `+${r.corte}` : r.corte}</td>
                  </tr>
                )}
                <tr>
                  <td className="py-2 font-bold">Total</td>
                  <td className="py-2 text-right text-lg font-bold tabular-nums">{r.total}</td>
                </tr>
              </tbody>
            </table>
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-bold">Histórico</h2>
            <ol className="space-y-3 border-l-2 border-ink-200 pl-4">
              {events.map((e) => (
                <li key={e.id}>
                  <p className="font-semibold">
                    {EVENT_LABEL[e.tipo] ?? e.tipo}
                    {e.tipo === "etapa" && `: ${e.de ?? "—"} → ${e.para}`}
                  </p>
                  {e.tipo === "nota" && typeof e.dados.texto === "string" && <p className="text-sm text-ink-700">{e.dados.texto}</p>}
                  <p className="text-xs text-ink-500">{e.created_at.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <StageControl leadId={lead.id} stages={stages} current={lead.no_crm ? lead.stage_id : null} />
          </Card>
          <Card>
            <h2 className="mb-2 text-lg font-bold">Dados do negócio</h2>
            <dl className="space-y-2 text-[15px]">
              <div><dt className="text-sm text-ink-500">Telefone</dt><dd>{lead.telefone_e164 ? <>{formatBrPhone(lead.telefone_e164)}{lead.whatsapp_provavel && <span className="text-emerald-700"> · WhatsApp provável</span>}</> : NA}</dd></div>
              <div><dt className="text-sm text-ink-500">Site</dt><dd>{lead.site ? <a href={lead.site} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-brand-700 underline">{lead.site}</a> : NA}</dd></div>
              <div><dt className="text-sm text-ink-500">Rede social divulgada</dt><dd>{lead.rede_social ? <a href={lead.rede_social} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-brand-700 underline">{lead.rede_social}</a> : NA}</dd></div>
              <div><dt className="text-sm text-ink-500">Avaliações no Google</dt><dd>{lead.nota !== null && lead.avaliacoes ? `★ ${fmtNota(lead.nota)} (${lead.avaliacoes} avaliações)` : NA}</dd></div>
              <div><dt className="text-sm text-ink-500">E-mail público</dt><dd>{lead.email_publico ?? NA}</dd></div>
              <div><dt className="text-sm text-ink-500">Endereço</dt><dd>{lead.endereco ?? NA}</dd></div>
              <div><dt className="text-sm text-ink-500">Horário</dt><dd>{lead.horario?.length ? <ul>{lead.horario.map((h) => <li key={h}>{h}</li>)}</ul> : NA}</dd></div>
              {lead.maps_url && <div><a href={lead.maps_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline">Ver no mapa</a></div>}
            </dl>
            <p className="mt-3 text-xs text-ink-500">
              Fonte: {lead.provider === "google_places" ? "Google" : lead.provider === "fake" ? "dados FICTÍCIOS de desenvolvimento" : "importação"} · coletado em{" "}
              {lead.coletado_em.toLocaleDateString("pt-BR")}
            </p>
          </Card>
          <Card>
            <h2 className="mb-2 text-lg font-bold">Próximos follow-ups</h2>
            <FollowupControl leadId={lead.id} followups={followups} />
          </Card>
          <Card>
            <InfoForm leadId={lead.id} valor={lead.valor_estimado_centavos} tags={tags} />
          </Card>
          <Card>
            <h2 className="mb-2 text-lg font-bold">Notas</h2>
            <NoteForm leadId={lead.id} />
            <ul className="mt-3 space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded-xl bg-ink-50 px-3 py-2 text-[15px]">
                  <p className="whitespace-pre-wrap">{n.texto}</p>
                  <p className="mt-1 text-xs text-ink-500">{n.created_at.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
