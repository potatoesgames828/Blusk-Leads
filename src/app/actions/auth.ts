"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { formString } from "@/lib/action-state";
import {
  AuthError,
  confirmEmail,
  requestPasswordReset,
  resetPassword,
  sendConfirmationEmail,
  signup,
  verifyLogin,
} from "@/lib/auth/service";
import { clientIp, currentUser, endSession, startSession } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";

export async function signupAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ip = await clientIp();
  if (!(await rateLimit(sql(), `signup:${ip}`, 10, 3600))) {
    return { error: "Muitas tentativas de cadastro. Tente de novo em uma hora." };
  }
  try {
    const { userId } = await signup(
      sql(),
      {
        nome: formString(fd, "nome"),
        email: formString(fd, "email"),
        senha: formString(fd, "senha"),
        aceitouTermos: fd.get("termos") === "on",
      },
      appUrl(),
    );
    await startSession(userId);
  } catch (err) {
    if (err instanceof AuthError) return { error: err.message };
    throw err;
  }
  redirect("/confirmar-email");
}

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = formString(fd, "email").trim().toLowerCase();
  const ip = await clientIp();
  const okIp = await rateLimit(sql(), `login-ip:${ip}`, 30, 900);
  const okEmail = await rateLimit(sql(), `login-email:${email}`, 8, 900);
  if (!okIp || !okEmail) return { error: "Muitas tentativas. Aguarde 15 minutos e tente de novo." };
  const userId = await verifyLogin(sql(), email, formString(fd, "senha"));
  if (!userId) return { error: "E-mail ou senha incorretos." };
  await startSession(userId);
  redirect("/hoje");
}

export async function logoutAction() {
  await endSession();
  redirect("/entrar");
}

export async function resendConfirmationAction(): Promise<ActionState> {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  if (user.emailConfirmado) redirect("/hoje");
  if (!(await rateLimit(sql(), `resend:${user.id}`, 3, 3600))) {
    return { error: "Você já pediu vários e-mails. Confira a caixa de spam ou tente mais tarde." };
  }
  await sendConfirmationEmail(sql(), user.id, user.email, user.nome, appUrl());
  return { ok: "Enviamos um novo link para o seu e-mail." };
}

export async function confirmEmailAction(token: string): Promise<boolean> {
  return confirmEmail(sql(), token);
}

export async function forgotPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = formString(fd, "email");
  const ip = await clientIp();
  if (!(await rateLimit(sql(), `reset:${ip}`, 5, 3600))) return { error: "Muitas tentativas. Tente de novo em uma hora." };
  await requestPasswordReset(sql(), email, appUrl());
  return { ok: "Se existir uma conta com esse e-mail, você vai receber um link para criar uma nova senha." };
}

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await resetPassword(sql(), formString(fd, "token"), formString(fd, "senha"));
  } catch (err) {
    if (err instanceof AuthError) return { error: err.message };
    throw err;
  }
  redirect("/entrar?senha=redefinida");
}
