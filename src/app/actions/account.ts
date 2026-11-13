"use server";

import { redirect } from "next/navigation";
import { formString, type ActionState } from "@/lib/action-state";
import { verifyPassword } from "@/lib/auth/password";
import { endSession, requireUser } from "@/lib/auth/session";
import { sql } from "@/lib/db";

/** Exclusão da conta a pedido do titular (LGPD). Exige a senha para confirmar. */
export async function deleteAccountAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (formString(fd, "confirmacao").trim().toUpperCase() !== "EXCLUIR") return { error: "Digite EXCLUIR para confirmar." };
  const [u] = await sql()<{ password_hash: string }[]>`select password_hash from users where id = ${user.id}`;
  if (!u || !(await verifyPassword(formString(fd, "senha"), u.password_hash))) return { error: "Senha incorreta." };

  await sql().begin(async (tx) => {
    await tx`
      delete from workspaces where id in (
        select workspace_id from workspace_members where user_id = ${user.id} and papel = 'owner')`;
    await tx`update audit_log set ator_id = null where ator_id = ${user.id}`;
    await tx`update removal_requests set revisado_por = null where revisado_por = ${user.id}`;
    await tx`update credit_ledger set criado_por = null where criado_por = ${user.id}`;
    await tx`delete from searches where user_id = ${user.id}`;
    await tx`delete from users where id = ${user.id}`;
    await tx`insert into audit_log (acao, alvo_tipo, alvo_id) values ('conta_excluida_pelo_titular', 'user', ${user.id})`;
  });
  await endSession();
  redirect("/?conta=excluida");
}

export async function logoutEverywhereAction() {
  const user = await requireUser();
  await sql()`delete from sessions where user_id = ${user.id}`;
  await endSession();
  redirect("/entrar");
}
