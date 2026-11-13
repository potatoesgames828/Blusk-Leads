"use server";

import { formString, type ActionState } from "@/lib/action-state";
import { clientIp } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { sendEmail } from "@/lib/mailer";
import { rateLimit } from "@/lib/rate-limit";
import { RemovalError, submitRemoval } from "@/lib/removal";

export async function removalAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ip = await clientIp();
  if (!(await rateLimit(sql(), `removal:${ip}`, 10, 3600))) {
    return { error: "Muitos pedidos seguidos. Tente de novo em uma hora." };
  }
  try {
    const email = formString(fd, "email").trim();
    await submitRemoval(sql(), {
      nomeEmpresa: formString(fd, "nome_empresa"),
      telefone: formString(fd, "telefone"),
      email: email || null,
      cidade: formString(fd, "cidade"),
      mensagem: formString(fd, "mensagem"),
    });
    if (email) {
      await sendEmail(
        sql(),
        email,
        "Sua empresa foi removida do Blusk Leads",
        "Recebemos o seu pedido. A partir de agora, sua empresa não aparece mais em nenhuma busca do Blusk Leads e foi retirada das listas de todos os usuários.\n\nSe você não fez esse pedido, responda este e-mail.\n\nEquipe Blusk Leads",
      );
    }
    return { ok: "Pronto. Sua empresa foi bloqueada em todas as contas e não vai aparecer em buscas futuras." };
  } catch (err) {
    if (err instanceof RemovalError) return { error: err.message };
    throw err;
  }
}
