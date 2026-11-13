import type { Sql } from "../db";
import { sendEmail } from "../mailer";
import { createWorkspaceForUser } from "../workspace";
import { hashPassword, passwordProblem, verifyPassword } from "./password";
import { hashToken, newToken } from "./tokens";

export const SESSION_DAYS = 30;
export const TERMS_VERSION = "2026-11-13";

export class AuthError extends Error {}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface SignupInput {
  nome: string;
  email: string;
  senha: string;
  aceitouTermos: boolean;
}

export async function signup(db: Sql, input: SignupInput, appUrl: string): Promise<{ userId: string }> {
  const nome = input.nome.trim();
  const email = input.email.trim().toLowerCase();
  if (nome.length < 2 || nome.length > 80) throw new AuthError("Informe seu nome.");
  if (!EMAIL_RE.test(email) || email.length > 200) throw new AuthError("E-mail inválido.");
  const problem = passwordProblem(input.senha);
  if (problem) throw new AuthError(problem);
  if (!input.aceitouTermos) throw new AuthError("Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.");

  const passwordHash = await hashPassword(input.senha);
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  const role = admins.includes(email) ? "admin" : "user";

  const userId = await db.begin(async (tx) => {
    const [existing] = await tx`select 1 from users where email = ${email}`;
    if (existing) throw new AuthError("Já existe uma conta com esse e-mail. Tente entrar ou recuperar a senha.");
    const [u] = await tx<{ id: string }[]>`
      insert into users (email, password_hash, nome, role) values (${email}, ${passwordHash}, ${nome}, ${role}) returning id`;
    await tx`insert into consents (user_id, tipo, versao) values (${u!.id}, 'termos', ${TERMS_VERSION}), (${u!.id}, 'privacidade', ${TERMS_VERSION})`;
    await createWorkspaceForUser(tx, u!.id, nome);
    return u!.id;
  });

  await sendConfirmationEmail(db, userId as string, email, nome, appUrl);
  return { userId: userId as string };
}

export async function sendConfirmationEmail(db: Sql, userId: string, email: string, nome: string, appUrl: string) {
  const token = newToken();
  await db`insert into email_tokens (token_hash, user_id, tipo, expires_at)
           values (${hashToken(token)}, ${userId}, 'confirmacao', now() + interval '2 days')`;
  await sendEmail(
    db,
    email,
    "Confirme seu e-mail no Blusk Leads",
    `Olá, ${nome}!\n\nConfirme seu e-mail para começar a usar o Blusk Leads:\n${appUrl}/confirmar-email?token=${token}\n\nO link vale por 2 dias. Se não foi você, ignore esta mensagem.\n\nEquipe Blusk Leads`,
  );
}

export async function confirmEmail(db: Sql, token: string): Promise<boolean> {
  return db.begin(async (tx) => {
    const [row] = await tx<{ user_id: string }[]>`
      update email_tokens set used_at = now()
      where token_hash = ${hashToken(token)} and tipo = 'confirmacao' and used_at is null and expires_at > now()
      returning user_id`;
    if (!row) return false;
    await tx`update users set email_confirmado_em = coalesce(email_confirmado_em, now()) where id = ${row.user_id}`;
    return true;
  }) as Promise<boolean>;
}

/** Retorna o id do usuário ou null. Mensagem de erro genérica para não revelar quais e-mails existem. */
export async function verifyLogin(db: Sql, email: string, senha: string): Promise<string | null> {
  const [u] = await db<{ id: string; password_hash: string }[]>`
    select id, password_hash from users where email = ${email.trim().toLowerCase()}`;
  if (!u) {
    await hashPassword(senha); // tempo de resposta parecido, exista ou não o e-mail
    return null;
  }
  return (await verifyPassword(senha, u.password_hash)) ? u.id : null;
}

export async function createSession(db: Sql, userId: string): Promise<{ token: string; expires: Date }> {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db`insert into sessions (id, user_id, expires_at) values (${hashToken(token)}, ${userId}, ${expires})`;
  return { token, expires };
}

export interface SessionUser {
  id: string;
  email: string;
  nome: string;
  role: "user" | "admin";
  emailConfirmado: boolean;
  workspaceId: string;
}

export async function getSessionUser(db: Sql, token: string): Promise<SessionUser | null> {
  const [u] = await db<
    { id: string; email: string; nome: string; role: "user" | "admin"; email_confirmado_em: Date | null; workspace_id: string }[]
  >`
    select u.id, u.email, u.nome, u.role, u.email_confirmado_em, m.workspace_id
    from sessions s
    join users u on u.id = s.user_id
    join workspace_members m on m.user_id = u.id
    where s.id = ${hashToken(token)} and s.expires_at > now()
    order by m.papel = 'owner' desc
    limit 1`;
  if (!u) return null;
  return { id: u.id, email: u.email, nome: u.nome, role: u.role, emailConfirmado: Boolean(u.email_confirmado_em), workspaceId: u.workspace_id };
}

export async function deleteSession(db: Sql, token: string): Promise<void> {
  await db`delete from sessions where id = ${hashToken(token)}`;
}

export async function requestPasswordReset(db: Sql, email: string, appUrl: string): Promise<void> {
  const [u] = await db<{ id: string; nome: string; email: string }[]>`
    select id, nome, email from users where email = ${email.trim().toLowerCase()}`;
  if (!u) return; // Não revela se o e-mail existe.
  const token = newToken();
  await db`insert into email_tokens (token_hash, user_id, tipo, expires_at)
           values (${hashToken(token)}, ${u.id}, 'redefinir_senha', now() + interval '1 hour')`;
  await sendEmail(
    db,
    u.email,
    "Redefinir sua senha do Blusk Leads",
    `Olá, ${u.nome}!\n\nPara criar uma nova senha, acesse:\n${appUrl}/redefinir-senha?token=${token}\n\nO link vale por 1 hora. Se não foi você, ignore esta mensagem: sua senha continua a mesma.\n\nEquipe Blusk Leads`,
  );
}

export async function resetPassword(db: Sql, token: string, senha: string): Promise<void> {
  const problem = passwordProblem(senha);
  if (problem) throw new AuthError(problem);
  const hash = await hashPassword(senha);
  await db.begin(async (tx) => {
    const [row] = await tx<{ user_id: string }[]>`
      update email_tokens set used_at = now()
      where token_hash = ${hashToken(token)} and tipo = 'redefinir_senha' and used_at is null and expires_at > now()
      returning user_id`;
    if (!row) throw new AuthError("Link inválido ou expirado. Peça um novo.");
    await tx`update users set password_hash = ${hash}, email_confirmado_em = coalesce(email_confirmado_em, now()) where id = ${row.user_id}`;
    await tx`delete from sessions where user_id = ${row.user_id}`; // encerra sessões antigas
  });
}
