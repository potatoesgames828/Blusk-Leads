import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db";

/** Exportação dos dados do titular (LGPD, art. 18). Tudo passa pela RLS do usuário. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const data = await withUser(user.id, async (tx) => ({
    exportado_em: new Date().toISOString(),
    usuario: (await tx`select id, email, nome, created_at, email_confirmado_em from users where id = ${user.id}`)[0],
    configuracoes: (await tx`select * from workspace_settings`)[0],
    etapas: await tx`select nome, ordem, tipo from pipeline_stages order by ordem`,
    buscas: await tx`select nicho, cidade, uf, filtro_oferta, status, pedidos, entregues, created_at from searches order by created_at`,
    leads: await tx`
      select l.id, l.score, l.score_recibo, l.temperatura, l.no_crm, s.nome as etapa, l.valor_estimado_centavos, l.motivo_perda,
        l.created_at, b.nome, b.categoria, b.endereco, b.cidade, b.uf, b.telefone_e164, b.site, b.rede_social, b.nota, b.avaliacoes
      from leads l join businesses b on b.id = l.business_id left join pipeline_stages s on s.id = l.stage_id
      where l.bloqueado_em is null order by l.created_at`,
    historico: await tx`select lead_id, tipo, de, para, dados, created_at from lead_events order by created_at`,
    mensagens: await tx`select lead_id, canal, variacao, assunto, texto, gerador, enviada_em, created_at from messages order by created_at`,
    notas: await tx`select lead_id, texto, created_at from lead_notes order by created_at`,
    followups: await tx`select lead_id, vence_em, concluido_em, origem from followups order by vence_em`,
    extrato_creditos: await tx`select delta, tipo, motivo, saldo_antes, saldo_depois, created_at from credit_ledger order by created_at`,
  }));
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="blusk-leads-meus-dados-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
