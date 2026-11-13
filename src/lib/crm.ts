import type { Tx } from "./db";

export const LOST_REASONS = [
  { id: "sem_resposta", nome: "Não respondeu" },
  { id: "sem_interesse", nome: "Sem interesse" },
  { id: "preco", nome: "Achou caro" },
  { id: "ja_tem_fornecedor", nome: "Já tem fornecedor" },
  { id: "momento", nome: "Não é o momento" },
  { id: "pediu_remocao", nome: "Pediu para não ser contatado" },
  { id: "outro", nome: "Outro" },
] as const;

export class CrmError extends Error {}

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Datas de follow-up da cadência: cada intervalo soma ao anterior (+3, +5, +7 => dias 3, 8, 15). */
export function cadenceDates(from: Date, intervals: number[]): string[] {
  let acc = 0;
  return intervals.filter((n) => n > 0).map((n) => addDays(from, (acc += n)));
}

/**
 * Move um lead de etapa (sempre dentro da transação RLS do usuário).
 * Grava evento no histórico; ao entrar em "Contatado" cria a cadência de follow-ups;
 * "Perdido" exige motivo.
 */
export async function moveLead(
  tx: Tx,
  p: { leadId: string; stageId: string; userId: string; motivoPerda?: string | null; motivoTexto?: string | null },
): Promise<{ stageChave: string | null; tipo: string }> {
  const [lead] = await tx<{ id: string; workspace_id: string; stage_id: string | null }[]>`
    select id, workspace_id, stage_id from leads where id = ${p.leadId} and bloqueado_em is null`;
  if (!lead) throw new CrmError("Lead não encontrado.");
  const [to] = await tx<{ id: string; nome: string; tipo: string; chave: string | null }[]>`
    select id, nome, tipo, chave from pipeline_stages where id = ${p.stageId} and workspace_id = ${lead.workspace_id}`;
  if (!to) throw new CrmError("Etapa não encontrada.");
  if (lead.stage_id === to.id) return { stageChave: to.chave, tipo: to.tipo };

  if (to.tipo === "perdido") {
    if (!p.motivoPerda) throw new CrmError("Informe o motivo da perda.");
    if (p.motivoPerda === "outro" && !p.motivoTexto?.trim()) throw new CrmError("Descreva o motivo da perda.");
  }
  const [from] = lead.stage_id
    ? await tx<{ nome: string }[]>`select nome from pipeline_stages where id = ${lead.stage_id}`
    : [];

  await tx`
    update leads set stage_id = ${to.id}, no_crm = true, ultima_interacao_em = now(),
      motivo_perda = ${to.tipo === "perdido" ? p.motivoPerda ?? null : null},
      motivo_perda_texto = ${to.tipo === "perdido" ? p.motivoTexto?.trim() || null : null}
    where id = ${lead.id}`;
  await tx`
    insert into lead_events (lead_id, workspace_id, user_id, tipo, de, para, dados)
    values (${lead.id}, ${lead.workspace_id}, ${p.userId}, 'etapa', ${from?.nome ?? null}, ${to.nome},
      ${tx.json(to.tipo === "perdido" ? { motivo: p.motivoPerda, texto: p.motivoTexto ?? null } : {})})`;

  if (to.tipo !== "aberto") {
    // Ganho ou perdido: encerra lembretes pendentes.
    await tx`update followups set concluido_em = now() where lead_id = ${lead.id} and concluido_em is null`;
  } else if (to.chave === "contatado") {
    const [pending] = await tx`select 1 from followups where lead_id = ${lead.id} and concluido_em is null`;
    if (!pending) {
      const [s] = await tx<{ cadencia_followup: number[] }[]>`
        select cadencia_followup from workspace_settings where workspace_id = ${lead.workspace_id}`;
      for (const date of cadenceDates(new Date(), s?.cadencia_followup ?? [3, 5, 7])) {
        await tx`insert into followups (lead_id, workspace_id, vence_em, origem) values (${lead.id}, ${lead.workspace_id}, ${date}, 'cadencia')`;
      }
    }
  }
  return { stageChave: to.chave, tipo: to.tipo };
}

/** Envia leads da lista de resultados para a primeira etapa do CRM. */
export async function sendToCrm(tx: Tx, leadIds: string[], userId: string): Promise<number> {
  if (leadIds.length === 0) return 0;
  const rows = await tx<{ id: string; workspace_id: string }[]>`
    select id, workspace_id from leads
    where id = any(${leadIds}::uuid[]) and not no_crm and descartado_em is null and bloqueado_em is null`;
  for (const r of rows) {
    const [first] = await tx<{ id: string; nome: string }[]>`
      select id, nome from pipeline_stages where workspace_id = ${r.workspace_id} order by ordem limit 1`;
    await tx`update leads set no_crm = true, stage_id = ${first!.id} where id = ${r.id}`;
    await tx`insert into lead_events (lead_id, workspace_id, user_id, tipo, para) values (${r.id}, ${r.workspace_id}, ${userId}, 'enviado_crm', ${first!.nome})`;
  }
  return rows.length;
}

export async function discardLeads(tx: Tx, leadIds: string[], userId: string): Promise<number> {
  if (leadIds.length === 0) return 0;
  const rows = await tx<{ id: string; workspace_id: string }[]>`
    update leads set descartado_em = now() where id = any(${leadIds}::uuid[]) and descartado_em is null
    returning id, workspace_id`;
  for (const r of rows) {
    await tx`insert into lead_events (lead_id, workspace_id, user_id, tipo) values (${r.id}, ${r.workspace_id}, ${userId}, 'descartado')`;
  }
  return rows.length;
}
