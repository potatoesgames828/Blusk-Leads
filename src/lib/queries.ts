import "server-only";
import type { ProfileValues } from "@/components/profile-form";
import type { Tx } from "./db";

export async function loadProfile(tx: Tx): Promise<ProfileValues & { cadencia_followup: number[] }> {
  const [s] = await tx<(ProfileValues & { regiao_padrao: ProfileValues["regiao"]; cadencia_followup: number[] })[]>`
    select ofertas, nichos_aceitos, nichos_excluidos, porte, regiao_padrao, estilo_mensagem, sobre_mim, cadencia_followup
    from workspace_settings limit 1`;
  if (!s) throw new Error("Configurações não encontradas");
  return { ...s, regiao: s.regiao_padrao };
}

export async function loadWorkspace(tx: Tx): Promise<{ id: string; plano: string; onboarding_concluido_em: Date | null; saldo: number }> {
  const [w] = await tx<{ id: string; plano: string; onboarding_concluido_em: Date | null; saldo: number }[]>`
    select w.id, w.plano, w.onboarding_concluido_em, coalesce(b.saldo, 0)::int as saldo
    from workspaces w left join credit_balances b on b.workspace_id = w.id limit 1`;
  if (!w) throw new Error("Conta não encontrada");
  return w;
}

export interface LeadCard {
  id: string;
  score: number;
  temperatura: "quente" | "morno" | "frio";
  nome: string;
  categoria: string | null;
  cidade: string | null;
  uf: string | null;
  telefone_e164: string | null;
  whatsapp_provavel: boolean;
  site: string | null;
  rede_social: string | null;
  nota: number | null;
  avaliacoes: number | null;
  stage_id: string | null;
  no_crm: boolean;
  descartado_em: Date | null;
  valor_estimado_centavos: number | null;
  ultima_interacao_em: Date | null;
  proximo_followup: string | null;
  tags: string[];
}

/** Colunas padrão de um card de lead (sempre filtra bloqueados). */
export const leadCardSelect = (tx: Tx) => tx`
  select l.id, l.score, l.temperatura, b.nome, b.categoria, b.cidade, b.uf, b.telefone_e164, b.whatsapp_provavel,
    b.site, b.rede_social, b.nota::float as nota, b.avaliacoes, l.stage_id, l.no_crm, l.descartado_em,
    l.valor_estimado_centavos::int as valor_estimado_centavos, l.ultima_interacao_em,
    (select to_char(min(f.vence_em), 'YYYY-MM-DD') from followups f where f.lead_id = l.id and f.concluido_em is null) as proximo_followup,
    coalesce((select array_agg(t.nome order by t.nome) from lead_tags lt join tags t on t.id = lt.tag_id where lt.lead_id = l.id), '{}') as tags
  from leads l join businesses b on b.id = l.business_id
  where l.bloqueado_em is null`;
