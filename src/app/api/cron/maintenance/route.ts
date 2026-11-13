import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { recoverStaleSearches } from "@/lib/search/run";

/**
 * Manutenção agendada (ex.: Vercel Cron a cada 10 minutos).
 * - encerra e estorna buscas presas;
 * - apaga sessões, tokens e limites de requisição vencidos;
 * - limpa conteúdo do Google vencido de negócios que não estão em nenhum lead (mantém só o place_id).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const db = sql();
  const recovered = await recoverStaleSearches(db);
  await db`delete from sessions where expires_at < now()`;
  await db`delete from email_tokens where expires_at < now() - interval '7 days'`;
  await db`delete from rate_limits where janela_inicio < now() - interval '1 day'`;
  const purged = await db`
    update businesses set nome = '(dados expirados)', categoria = null, endereco = null, telefone_e164 = null,
      site = null, rede_social = null, nota = null, avaliacoes = null, horario = null, maps_url = null, lat = null, lng = null
    where provider = 'google_places' and expira_em < now() and nome <> '(dados expirados)'
      and not exists (select 1 from leads l where l.business_id = businesses.id)
    returning id`;
  return NextResponse.json({ buscas_recuperadas: recovered, negocios_limpos: purged.length });
}
