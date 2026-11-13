import { signup } from "@/lib/auth/service";
import { sql } from "@/lib/db";

let n = 0;

export async function makeUser(opts: { plano?: "teste" | "pago"; creditos?: number; ofertas?: string[]; excluidos?: string[] } = {}) {
  const db = sql();
  const email = `user${Date.now()}${n++}@teste.local`;
  const { userId } = await signup(db, { nome: "Pessoa Teste", email, senha: "senha123abc", aceitouTermos: true }, "http://localhost");
  await db`update users set email_confirmado_em = now() where id = ${userId}`;
  const [m] = await db<{ workspace_id: string }[]>`select workspace_id from workspace_members where user_id = ${userId}`;
  const workspaceId = m!.workspace_id;
  if (opts.plano) await db`update workspaces set plano = ${opts.plano} where id = ${workspaceId}`;
  if (opts.ofertas) await db`update workspace_settings set ofertas = ${opts.ofertas} where workspace_id = ${workspaceId}`;
  if (opts.excluidos) await db`update workspace_settings set nichos_excluidos = ${opts.excluidos} where workspace_id = ${workspaceId}`;
  if (opts.creditos !== undefined) {
    const [b] = await db<{ saldo: number }[]>`select saldo from credit_balances where workspace_id = ${workspaceId}`;
    const delta = opts.creditos - (b?.saldo ?? 0);
    if (delta !== 0) {
      await db`select app.credit_apply(${workspaceId}, ${delta}, 'ajuste_admin', 'teste', null, null, ${`teste:${workspaceId}:${n++}`}, null)`;
    }
  }
  return { userId, workspaceId, email };
}

export async function balance(workspaceId: string): Promise<number> {
  const [b] = await sql()<{ saldo: number }[]>`select saldo from credit_balances where workspace_id = ${workspaceId}`;
  return b?.saldo ?? 0;
}
