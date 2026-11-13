"use server";

import { revalidatePath } from "next/cache";
import { buildFacts } from "@/lib/ai/facts";
import { generateMessages } from "@/lib/ai/generate";
import type { MessagePack } from "@/lib/ai/templates";
import type { ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth/session";
import { CrmError, moveLead, sendToCrm } from "@/lib/crm";
import { sql, withUser } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const isUuid = (s: string) => /^[0-9a-f-]{36}$/.test(s);

export interface GeneratedMessages {
  pack: MessagePack;
  ids: { curta: string; media: string; pergunta: string; email: string; ligacao: string };
  gerador: "ia" | "modelo";
  substituicoes: string[];
  error?: string;
}

export async function generateMessagesAction(leadId: string): Promise<GeneratedMessages | { error: string }> {
  const user = await requireUser();
  if (!isUuid(leadId)) return { error: "Lead inválido." };
  if (!(await rateLimit(sql(), `msg:${user.id}`, 40, 3600))) {
    return { error: "Você gerou muitas mensagens na última hora. Aguarde um pouco." };
  }
  const ctx = await withUser(user.id, async (tx) => {
    const [l] = await tx<{ nome: string; categoria: string | null; cidade: string | null; site: string | null; rede_social: string | null; nota: number | null; avaliacoes: number | null; telefone_e164: string | null; workspace_id: string }[]>`
      select b.nome, b.categoria, b.cidade, b.site, b.rede_social, b.nota::float as nota, b.avaliacoes, b.telefone_e164, l.workspace_id
      from leads l join businesses b on b.id = l.business_id where l.id = ${leadId} and l.bloqueado_em is null`;
    const [s] = await tx<{ ofertas: string[]; estilo_mensagem: "formal" | "amigavel" | "direto"; sobre_mim: string }[]>`
      select ofertas, estilo_mensagem, sobre_mim from workspace_settings limit 1`;
    return l && s ? { l, s } : null;
  });
  if (!ctx) return { error: "Lead não encontrado." };

  const facts = buildFacts({
    nome: ctx.l.nome, categoria: ctx.l.categoria, cidade: ctx.l.cidade, site: ctx.l.site, redeSocial: ctx.l.rede_social,
    nota: ctx.l.nota, avaliacoes: ctx.l.avaliacoes, telefoneE164: ctx.l.telefone_e164,
  });
  const result = await generateMessages({
    facts, nomeNegocio: ctx.l.nome, estilo: ctx.s.estilo_mensagem, ofertas: ctx.s.ofertas, sobreMim: ctx.s.sobre_mim, nomeUsuario: user.nome,
  });
  if (result.gerador === "ia") await sql()`insert into api_usage (workspace_id, servico, operacao) values (${ctx.l.workspace_id}, 'ia', 'mensagens')`;

  const ids = await withUser(user.id, async (tx) => {
    const ins = async (canal: string, variacao: string, texto: string, assunto: string | null = null) => {
      const [r] = await tx<{ id: string }[]>`
        insert into messages (lead_id, workspace_id, canal, variacao, assunto, texto, fatos_usados, gerador)
        values (${leadId}, ${ctx.l.workspace_id}, ${canal}, ${variacao}, ${assunto}, ${texto}, ${tx.json(facts as never)}, ${result.gerador})
        returning id`;
      return r!.id;
    };
    const out = {
      curta: await ins("whatsapp", "curta", result.pack.whatsapp.curta),
      media: await ins("whatsapp", "media", result.pack.whatsapp.media),
      pergunta: await ins("whatsapp", "pergunta", result.pack.whatsapp.pergunta),
      email: await ins("email", "email", result.pack.email.corpo, result.pack.email.assunto),
      ligacao: await ins("ligacao", "roteiro", result.pack.ligacao.join("\n")),
    };
    await tx`insert into lead_events (lead_id, workspace_id, user_id, tipo, dados) values (${leadId}, ${ctx.l.workspace_id}, ${user.id}, 'mensagem_gerada', ${tx.json({ gerador: result.gerador })})`;
    return out;
  });
  revalidatePath(`/leads/${leadId}`);
  return { pack: result.pack, ids, gerador: result.gerador, substituicoes: result.substituicoes };
}

/** Registra que o usuário abriu o WhatsApp/e-mail com a mensagem (o envio em si é manual, fora do sistema). */
export async function markMessageSentAction(messageId: string, textoFinal: string): Promise<void> {
  const user = await requireUser();
  if (!isUuid(messageId)) return;
  await withUser(user.id, async (tx) => {
    const [m] = await tx<{ lead_id: string; workspace_id: string; canal: string; texto: string }[]>`
      update messages set enviada_em = now(), texto = ${textoFinal.slice(0, 5000)}
      where id = ${messageId} returning lead_id, workspace_id, canal, texto`;
    if (!m) return;
    await tx`update leads set ultima_interacao_em = now() where id = ${m.lead_id}`;
    await tx`insert into lead_events (lead_id, workspace_id, user_id, tipo, dados) values (${m.lead_id}, ${m.workspace_id}, ${user.id}, 'mensagem_enviada', ${tx.json({ canal: m.canal, message_id: messageId })})`;
  });
  revalidatePath("/", "layout");
}

export async function moveStageAction(leadId: string, stageId: string, motivo?: string | null, texto?: string | null): Promise<ActionState> {
  const user = await requireUser();
  if (!isUuid(leadId) || !isUuid(stageId)) return { error: "Dados inválidos." };
  try {
    const r = await withUser(user.id, (tx) => moveLead(tx, { leadId, stageId, userId: user.id, motivoPerda: motivo, motivoTexto: texto }));
    revalidatePath("/crm");
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/hoje");
    if (r.tipo === "ganho") return { ok: "Negócio fechado! A criação de projeto a partir do lead chega na próxima fase." };
    if (r.stageChave === "contatado") return { ok: "Marcado como contatado. Criamos lembretes de follow-up para você." };
    return { ok: "Etapa atualizada." };
  } catch (err) {
    if (err instanceof CrmError) return { error: err.message };
    throw err;
  }
}

/** Atalho: envia ao CRM (se preciso) e move para "Contatado". */
export async function markContactedAction(leadId: string): Promise<ActionState> {
  const user = await requireUser();
  if (!isUuid(leadId)) return { error: "Lead inválido." };
  const stageId = await withUser(user.id, async (tx) => {
    await sendToCrm(tx, [leadId], user.id);
    const [s] = await tx<{ id: string }[]>`select id from pipeline_stages where chave = 'contatado' limit 1`;
    return s?.id ?? null;
  });
  if (!stageId) return { error: "Etapa “Contatado” não encontrada. Confira as etapas em Ajustes." };
  return moveStageAction(leadId, stageId);
}

export async function addFollowupAction(leadId: string, date: string): Promise<ActionState> {
  const user = await requireUser();
  if (!isUuid(leadId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Escolha uma data válida." };
  await withUser(user.id, async (tx) => {
    const [l] = await tx<{ workspace_id: string }[]>`select workspace_id from leads where id = ${leadId}`;
    if (!l) return;
    await tx`insert into followups (lead_id, workspace_id, vence_em, origem) values (${leadId}, ${l.workspace_id}, ${date}, 'manual')`;
    await tx`insert into lead_events (lead_id, workspace_id, user_id, tipo, dados) values (${leadId}, ${l.workspace_id}, ${user.id}, 'followup', ${tx.json({ data: date })})`;
  });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/hoje");
  return { ok: "Lembrete criado." };
}

export async function completeFollowupAction(followupId: string): Promise<void> {
  const user = await requireUser();
  if (!isUuid(followupId)) return;
  await withUser(user.id, async (tx) => {
    const [f] = await tx<{ lead_id: string; workspace_id: string }[]>`
      update followups set concluido_em = now() where id = ${followupId} and concluido_em is null returning lead_id, workspace_id`;
    if (f) {
      await tx`update leads set ultima_interacao_em = now() where id = ${f.lead_id}`;
      await tx`insert into lead_events (lead_id, workspace_id, user_id, tipo) values (${f.lead_id}, ${f.workspace_id}, ${user.id}, 'followup_concluido')`;
    }
  });
  revalidatePath("/", "layout");
}

export async function addNoteAction(leadId: string, texto: string): Promise<ActionState> {
  const user = await requireUser();
  const t = texto.trim();
  if (!isUuid(leadId) || t.length < 1 || t.length > 2000) return { error: "Escreva uma nota de até 2.000 caracteres." };
  await withUser(user.id, async (tx) => {
    const [l] = await tx<{ workspace_id: string }[]>`select workspace_id from leads where id = ${leadId}`;
    if (!l) return;
    await tx`insert into lead_notes (lead_id, workspace_id, user_id, texto) values (${leadId}, ${l.workspace_id}, ${user.id}, ${t})`;
    await tx`insert into lead_events (lead_id, workspace_id, user_id, tipo, dados) values (${leadId}, ${l.workspace_id}, ${user.id}, 'nota', ${tx.json({ texto: t.slice(0, 140) })})`;
  });
  revalidatePath(`/leads/${leadId}`);
  return { ok: "Nota salva." };
}

export async function updateLeadInfoAction(leadId: string, valorReais: string, tagsText: string): Promise<ActionState> {
  const user = await requireUser();
  if (!isUuid(leadId)) return { error: "Lead inválido." };
  const clean = valorReais.replace(/[^\d,.]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", ".");
  const valor = clean ? Math.round(Number(clean) * 100) : null;
  if (valor !== null && (!Number.isFinite(valor) || valor < 0 || valor > 100_000_000_00)) return { error: "Valor inválido." };
  const tags = [...new Set(tagsText.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 10).map((t) => t.slice(0, 30));
  await withUser(user.id, async (tx) => {
    const [l] = await tx<{ workspace_id: string }[]>`update leads set valor_estimado_centavos = ${valor} where id = ${leadId} returning workspace_id`;
    if (!l) return;
    await tx`delete from lead_tags where lead_id = ${leadId}`;
    for (const nome of tags) {
      const [t] = await tx<{ id: string }[]>`
        insert into tags (workspace_id, nome) values (${l.workspace_id}, ${nome})
        on conflict (workspace_id, nome) do update set nome = excluded.nome returning id`;
      await tx`insert into lead_tags (lead_id, tag_id, workspace_id) values (${leadId}, ${t!.id}, ${l.workspace_id})`;
    }
  });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/crm");
  return { ok: "Informações salvas." };
}
