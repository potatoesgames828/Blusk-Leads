"use server";

import { revalidatePath } from "next/cache";
import { formString, type ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth/session";
import { applyCredit, InsufficientCreditsError } from "@/lib/credits";
import { sql } from "@/lib/db";
import { rejectRemoval } from "@/lib/removal";

export async function adjustCreditsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const email = formString(fd, "email").trim().toLowerCase();
  const delta = Number(formString(fd, "delta"));
  const motivo = formString(fd, "motivo").trim();
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100_000) return { error: "Informe um número inteiro diferente de zero." };
  if (motivo.length < 5) return { error: "O motivo é obrigatório (mínimo 5 caracteres)." };
  const [ws] = await sql()<{ workspace_id: string }[]>`
    select m.workspace_id from users u join workspace_members m on m.user_id = u.id where u.email = ${email} and m.papel = 'owner' limit 1`;
  if (!ws) return { error: "Usuário não encontrado." };
  try {
    const entry = await applyCredit(sql(), {
      workspaceId: ws.workspace_id,
      delta,
      tipo: "ajuste_admin",
      motivo: `Ajuste do suporte: ${motivo}`,
      key: `admin:${admin.id}:${crypto.randomUUID()}`,
      actorId: admin.id,
    });
    await sql()`insert into audit_log (ator_id, acao, alvo_tipo, alvo_id, dados)
      values (${admin.id}, 'ajuste_creditos', 'workspace', ${ws.workspace_id}, ${sql().json({ delta, motivo, saldo_depois: entry.saldo_depois })})`;
    revalidatePath("/admin");
    return { ok: `Pronto. Novo saldo de ${email}: ${entry.saldo_depois} créditos.` };
  } catch (err) {
    if (err instanceof InsufficientCreditsError) return { error: "O ajuste deixaria o saldo negativo." };
    throw err;
  }
}

export async function setPlanAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const email = formString(fd, "email").trim().toLowerCase();
  const plano = formString(fd, "plano");
  if (plano !== "teste" && plano !== "pago") return { error: "Plano inválido." };
  const rows = await sql()<{ id: string }[]>`
    update workspaces set plano = ${plano}
    where id in (select m.workspace_id from users u join workspace_members m on m.user_id = u.id where u.email = ${email} and m.papel = 'owner')
    returning id`;
  if (!rows.length) return { error: "Usuário não encontrado." };
  await sql()`insert into audit_log (ator_id, acao, alvo_tipo, alvo_id, dados) values (${admin.id}, 'plano_alterado', 'workspace', ${rows[0]!.id}, ${sql().json({ plano })})`;
  revalidatePath("/admin");
  return { ok: `Plano de ${email} alterado para ${plano}.` };
}

export async function rejectRemovalAction(requestId: string): Promise<void> {
  const admin = await requireAdmin();
  if (!/^[0-9a-f-]{36}$/.test(requestId)) return;
  await rejectRemoval(sql(), requestId, admin.id);
  revalidatePath("/admin");
}
