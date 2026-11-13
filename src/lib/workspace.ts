import { applyCredit } from "./credits";
import type { Sql, Tx } from "./db";
import { getAppSettings } from "./settings";

export const DEFAULT_STAGES: { chave: string; nome: string; tipo: "aberto" | "ganho" | "perdido" }[] = [
  { chave: "novo", nome: "Novo", tipo: "aberto" },
  { chave: "qualificado", nome: "Qualificado", tipo: "aberto" },
  { chave: "contatado", nome: "Contatado", tipo: "aberto" },
  { chave: "negociacao", nome: "Em negociação", tipo: "aberto" },
  { chave: "proposta", nome: "Proposta enviada", tipo: "aberto" },
  { chave: "ganho", nome: "Fechado (ganho)", tipo: "ganho" },
  { chave: "perdido", nome: "Perdido", tipo: "perdido" },
];

/** Cria a conta (workspace) de um novo usuário com configurações padrão e créditos do teste grátis. */
export async function createWorkspaceForUser(db: Sql | Tx, userId: string, nome: string): Promise<string> {
  const [ws] = await db<{ id: string }[]>`insert into workspaces (nome) values (${nome}) returning id`;
  const id = ws!.id;
  await db`insert into workspace_members (workspace_id, user_id, papel) values (${id}, ${userId}, 'owner')`;
  // Exemplo da configuração padrão pedida: aceita tudo, exceto advocacia (editável em Ajustes).
  await db`insert into workspace_settings (workspace_id, nichos_excluidos) values (${id}, ${["advocacia"]})`;
  for (const [i, st] of DEFAULT_STAGES.entries()) {
    await db`insert into pipeline_stages (workspace_id, nome, ordem, tipo, chave)
             values (${id}, ${st.nome}, ${i}, ${st.tipo}, ${st.chave})`;
  }
  const settings = await getAppSettings(db);
  await applyCredit(db, {
    workspaceId: id,
    delta: settings.leadsTesteGratis * settings.creditosPorLead.brasil,
    tipo: "teste_gratis",
    motivo: `Teste grátis: ${settings.leadsTesteGratis} leads, sem cartão`,
    key: `workspace:${id}:teste_gratis`,
    refTipo: "workspace",
    refId: id,
  });
  return id;
}

export async function getUserWorkspaceId(db: Sql | Tx, userId: string): Promise<string | null> {
  const [row] = await db<{ workspace_id: string }[]>`
    select workspace_id from workspace_members where user_id = ${userId} order by papel = 'owner' desc limit 1`;
  return row?.workspace_id ?? null;
}
