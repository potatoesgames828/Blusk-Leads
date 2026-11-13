import { notFound } from "next/navigation";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Caixa de e-mails de desenvolvimento. Não existe em produção. */
export default async function DevEmails() {
  if (process.env.NODE_ENV === "production") notFound();
  const emails = await sql()<{ id: string; para: string; assunto: string; corpo_texto: string; created_at: Date }[]>`
    select id, para, assunto, corpo_texto, created_at from outbox_emails order by created_at desc limit 30`;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Caixa de e-mails (dev)</h1>
      <p className="text-ink-600">Só existe em desenvolvimento. Em produção os e-mails são enviados de verdade.</p>
      <ul className="mt-4 space-y-3">
        {emails.map((e) => (
          <li key={e.id} className="rounded-2xl border border-ink-200 bg-white p-4" data-testid="dev-email">
            <p className="text-sm text-ink-600">Para {e.para} · {e.created_at.toLocaleString("pt-BR")}</p>
            <p className="font-semibold">{e.assunto}</p>
            <pre className="mt-2 whitespace-pre-wrap break-all font-sans text-[15px]">
              {e.corpo_texto.split(/(https?:\/\/\S+)/).map((part, i) =>
                /^https?:\/\//.test(part) ? <a key={i} href={part} className="text-brand-700 underline">{part}</a> : part,
              )}
            </pre>
          </li>
        ))}
      </ul>
    </div>
  );
}
