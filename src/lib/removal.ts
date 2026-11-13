import type { Sql } from "./db";
import { normalizeBrPhone } from "./phone";
import { phoneHash } from "./phone-hash";

export class RemovalError extends Error {}

/**
 * Pedido público "Remover minha empresa". Aplicado na hora (privacidade em primeiro lugar):
 *  - bloqueia o telefone em todas as buscas futuras de todas as contas;
 *  - tira o negócio de todas as listas e CRMs (leads marcados como bloqueados).
 * O administrador pode revisar e desfazer pedidos abusivos.
 */
export async function submitRemoval(
  db: Sql,
  input: { nomeEmpresa: string; telefone: string; email?: string | null; cidade?: string | null; mensagem?: string | null },
): Promise<{ id: string; leadsAfetados: number }> {
  const nome = input.nomeEmpresa.trim();
  if (nome.length < 2 || nome.length > 120) throw new RemovalError("Informe o nome da empresa.");
  const phone = normalizeBrPhone(input.telefone);
  if (!phone) throw new RemovalError("Informe o telefone da empresa com DDD, como aparece no Google.");
  const hash = phoneHash(phone.e164);

  return db.begin(async (tx) => {
    const [req] = await tx<{ id: string }[]>`
      insert into removal_requests (nome_empresa, telefone_hash, telefone_final, contato_email, cidade, mensagem)
      values (${nome}, ${hash}, ${phone.e164.slice(-4)}, ${input.email?.trim() || null}, ${input.cidade?.trim() || null},
              ${input.mensagem?.trim().slice(0, 1000) || null})
      returning id`;
    await tx`
      insert into blocked_businesses (telefone_hash, motivo, origem, removal_request_id)
      values (${hash}, 'Pedido de remoção feito pela empresa', 'pedido_remocao', ${req!.id})`;
    // Bloqueia também pelos identificadores do provedor (o telefone pode mudar no Google depois).
    await tx`
      insert into blocked_businesses (provider, provider_id, motivo, origem, removal_request_id)
      select provider, provider_id, 'Pedido de remoção feito pela empresa', 'pedido_remocao', ${req!.id}
      from businesses where telefone_hash = ${hash}`;
    const affected = await tx`
      update leads set bloqueado_em = now()
      where bloqueado_em is null and business_id in (select id from businesses where telefone_hash = ${hash})
      returning id`;
    await tx`update removal_requests set leads_afetados = ${affected.length} where id = ${req!.id}`;
    return { id: req!.id, leadsAfetados: affected.length };
  }) as Promise<{ id: string; leadsAfetados: number }>;
}

/** Administrador desfaz um pedido abusivo (ex.: concorrente pedindo remoção de outra empresa). */
export async function rejectRemoval(db: Sql, requestId: string, adminId: string): Promise<void> {
  await db.begin(async (tx) => {
    const [req] = await tx<{ telefone_hash: string | null }[]>`
      update removal_requests set status = 'rejeitado', revisado_por = ${adminId}, revisado_em = now()
      where id = ${requestId} and status = 'aplicado' returning telefone_hash`;
    if (!req) return;
    await tx`update blocked_businesses set ativo = false where removal_request_id = ${requestId}`;
    await tx`
      update leads set bloqueado_em = null
      where business_id in (select id from businesses where telefone_hash = ${req.telefone_hash})
        and not exists (
          select 1 from blocked_businesses bb join businesses b on b.id = leads.business_id
          where bb.ativo and (bb.telefone_hash = b.telefone_hash or (bb.provider = b.provider and bb.provider_id = b.provider_id)))`;
    await tx`insert into audit_log (ator_id, acao, alvo_tipo, alvo_id) values (${adminId}, 'remocao_rejeitada', 'removal_request', ${requestId})`;
  });
}
