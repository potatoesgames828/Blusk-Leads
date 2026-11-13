import type { Sql } from "./db";

/**
 * Envio de e-mail transacional. Todo e-mail passa pela tabela outbox_emails (log de envio).
 * Sem RESEND_API_KEY (desenvolvimento), o e-mail fica só na caixa de dev: /dev/emails.
 */
export async function sendEmail(db: Sql, to: string, subject: string, text: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const [row] = await db<{ id: string }[]>`
    insert into outbox_emails (para, assunto, corpo_texto, status)
    values (${to}, ${subject}, ${text}, ${key ? "pendente" : "dev"}) returning id`;
  if (!key) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await db`update outbox_emails set status = 'enviado', enviado_em = now() where id = ${row!.id}`;
    await db`insert into api_usage (servico, operacao) values ('email', 'send')`;
  } catch (err) {
    await db`update outbox_emails set status = 'falhou', erro = ${String(err).slice(0, 300)} where id = ${row!.id}`;
  }
}
