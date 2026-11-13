import type { Sql } from "../db";
import { phoneHash } from "../phone-hash";
import { getLeadProvider } from "../providers";

/**
 * Política de cache do Google: dados do Places têm prazo de validade (expira_em).
 * Ao abrir um lead vencido, renovamos pela API oficial; se o negócio sumiu, mantemos só o id.
 * Falha na renovação não quebra a tela (mostra os dados que já temos).
 */
export async function refreshBusinessIfExpired(db: Sql, businessId: string): Promise<void> {
  const [b] = await db<{ provider: string; provider_id: string; expira_em: Date | null }[]>`
    select provider, provider_id, expira_em from businesses where id = ${businessId}`;
  if (!b || b.provider !== "google_places" || !b.expira_em || b.expira_em > new Date()) return;
  if (process.env.LEAD_PROVIDER !== "google_places") return;
  try {
    const fresh = await getLeadProvider().getDetails(b.provider_id);
    await db`insert into api_usage (servico, operacao) values ('places', 'details')`;
    if (!fresh) return;
    const days = 30;
    await db`
      update businesses set nome = ${fresh.nome}, categoria = ${fresh.categoria}, endereco = ${fresh.endereco},
        telefone_e164 = ${fresh.telefoneE164}, telefone_hash = ${fresh.telefoneE164 ? phoneHash(fresh.telefoneE164) : null},
        whatsapp_provavel = ${fresh.whatsappProvavel}, site = ${fresh.site}, rede_social = ${fresh.redeSocial},
        nota = ${fresh.nota}, avaliacoes = ${fresh.avaliacoes}, horario = ${fresh.horario ? db.json(fresh.horario) : null},
        status_funcionamento = ${fresh.statusFuncionamento}, coletado_em = now(),
        expira_em = now() + make_interval(days => ${days})
      where id = ${businessId}`;
  } catch (err) {
    console.error(JSON.stringify({ evento: "refresh_falhou", businessId, erro: String(err) }));
  }
}
