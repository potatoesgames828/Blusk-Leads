import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { sql } from "../db";
import { createSession, deleteSession, getSessionUser, type SessionUser } from "./service";

export const SESSION_COOKIE = "blusk_session";

export async function startSession(userId: string): Promise<void> {
  const { token, expires } = await createSession(sql(), userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(sql(), token);
  jar.delete(SESSION_COOKIE);
}

/** Usuário logado (memoizado por requisição) ou null. */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getSessionUser(sql(), token);
});

/** Exige login com e-mail confirmado. Redireciona quando faltar algo. */
export async function requireUser(opts: { allowUnconfirmed?: boolean } = {}): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/entrar");
  if (!user.emailConfirmado && !opts.allowUnconfirmed) redirect("/confirmar-email");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/hoje");
  return user;
}

/** IP do cliente para limite de requisições (nunca é guardado em log). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}
