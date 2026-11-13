/**
 * Cria uma conta de DEMONSTRAÇÃO para desenvolvimento (nunca rode em produção).
 * E-mail: demo@blusk.local · Senha: demo12345 · plano pago · 100 créditos · administrador.
 */
import postgres from "postgres";
import { hashPassword } from "../src/lib/auth/password";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Seed de demonstração não roda em produção.");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Defina DATABASE_URL");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const email = "demo@blusk.local";
    const [exists] = await sql`select 1 from users where email = ${email}`;
    if (exists) {
      console.log("Conta demo já existe: demo@blusk.local / demo12345");
      return;
    }
    await sql.begin(async (tx) => {
      const [u] = await tx<{ id: string }[]>`
        insert into users (email, password_hash, nome, role, email_confirmado_em)
        values (${email}, ${await hashPassword("demo12345")}, 'Conta Demo', 'admin', now()) returning id`;
      const [w] = await tx<{ id: string }[]>`insert into workspaces (nome, plano, onboarding_concluido_em) values ('Demo', 'pago', now()) returning id`;
      await tx`insert into workspace_members (workspace_id, user_id) values (${w!.id}, ${u!.id})`;
      await tx`insert into workspace_settings (workspace_id, ofertas, nichos_excluidos, sobre_mim)
               values (${w!.id}, ${["motion"]}, ${["advocacia"]}, 'Faço vídeos animados para negócios locais.')`;
      const stages = [["novo", "Novo", "aberto"], ["qualificado", "Qualificado", "aberto"], ["contatado", "Contatado", "aberto"],
        ["negociacao", "Em negociação", "aberto"], ["proposta", "Proposta enviada", "aberto"], ["ganho", "Fechado (ganho)", "ganho"], ["perdido", "Perdido", "perdido"]];
      for (const [i, [chave, nome, tipo]] of stages.entries()) {
        await tx`insert into pipeline_stages (workspace_id, nome, ordem, tipo, chave) values (${w!.id}, ${nome!}, ${i}, ${tipo!}, ${chave!})`;
      }
      await tx`select app.credit_apply(${w!.id}, 100, 'bonus', 'Créditos de demonstração (dev)', null, null, ${`seed:${w!.id}`}, null)`;
    });
    console.log("Conta demo criada: demo@blusk.local / demo12345 (100 créditos, plano pago, admin)");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
