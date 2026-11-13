import type { Sql, Tx } from "./db";

export interface AppSettings {
  creditosPorLead: { brasil: number; exterior_br: number; internacional: number };
  diasExclusividade: number;
  leadsTesteGratis: number;
  diasCacheGoogle: number;
}

/** Configurações do administrador (tabela app_settings), nunca fixas no código. */
export async function getAppSettings(db: Sql | Tx): Promise<AppSettings> {
  const rows = await db<{ chave: string; valor: unknown }[]>`select chave, valor from app_settings`;
  const m = new Map(rows.map((r) => [r.chave, r.valor]));
  return {
    creditosPorLead: (m.get("creditos_por_lead") as AppSettings["creditosPorLead"]) ?? { brasil: 1, exterior_br: 2, internacional: 3 },
    diasExclusividade: Number(m.get("dias_exclusividade") ?? 30),
    leadsTesteGratis: Number(m.get("leads_teste_gratis") ?? 5),
    diasCacheGoogle: Number(m.get("dias_cache_google") ?? 30),
  };
}
