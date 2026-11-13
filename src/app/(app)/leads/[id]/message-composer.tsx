"use client";

import { useState, useTransition } from "react";
import { generateMessagesAction, markContactedAction, markMessageSentAction, type GeneratedMessages } from "@/app/actions/leads";
import { Alert, Button, Textarea, cx } from "@/components/ui";
import { whatsappLink } from "@/lib/whatsapp";

type Tab = "curta" | "media" | "pergunta" | "email" | "ligacao";
const TABS: { id: Tab; label: string }[] = [
  { id: "curta", label: "Curta" },
  { id: "media", label: "Média" },
  { id: "pergunta", label: "Com pergunta" },
  { id: "email", label: "E-mail" },
  { id: "ligacao", label: "Ligação" },
];

export function MessageComposer({ leadId, telefone, nomeNegocio, emailPublico }: { leadId: string; telefone: string | null; nomeNegocio: string; emailPublico: string | null }) {
  const [data, setData] = useState<GeneratedMessages | null>(null);
  const [texts, setTexts] = useState<Record<Tab, string>>({ curta: "", media: "", pergunta: "", email: "", ligacao: "" });
  const [assunto, setAssunto] = useState("");
  const [tab, setTab] = useState<Tab>("curta");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const generate = () =>
    start(async () => {
      setError(null);
      setInfo(null);
      const r = await generateMessagesAction(leadId);
      if ("error" in r && !("pack" in r)) {
        setError(r.error);
        return;
      }
      const g = r as GeneratedMessages;
      setData(g);
      setTexts({
        curta: g.pack.whatsapp.curta,
        media: g.pack.whatsapp.media,
        pergunta: g.pack.whatsapp.pergunta,
        email: g.pack.email.corpo,
        ligacao: g.pack.ligacao.map((t) => `• ${t}`).join("\n"),
      });
      setAssunto(g.pack.email.assunto);
    });

  const isWhats = tab === "curta" || tab === "media" || tab === "pergunta";
  const messageId = data ? (isWhats ? data.ids[tab] : tab === "email" ? data.ids.email : data.ids.ligacao) : null;

  const copy = async () => {
    await navigator.clipboard.writeText(tab === "email" ? `${assunto}\n\n${texts.email}` : texts[tab]);
    setInfo("Copiado.");
  };

  return (
    <div className="space-y-3">
      {!data ? (
        <div className="space-y-2">
          <p className="text-[15px] text-ink-600">Gera 3 versões para WhatsApp, um e-mail e um roteiro de ligação, citando só fatos reais deste negócio.</p>
          <Button onClick={generate} disabled={pending} className="w-full sm:w-auto">
            {pending ? "Gerando…" : "Gerar mensagem"}
          </Button>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Variações" className="relative -mx-1 flex gap-1 overflow-x-auto px-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cx("min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold", tab === t.id ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-700 hover:bg-ink-200")}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === "email" && (
            <input
              aria-label="Assunto do e-mail"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              className="block min-h-11 w-full rounded-xl border border-ink-300 px-3 font-semibold"
            />
          )}
          <Textarea
            aria-label="Texto da mensagem (pode editar)"
            value={texts[tab]}
            onChange={(e) => setTexts({ ...texts, [tab]: e.target.value })}
            className="min-h-48 text-[15px] leading-relaxed"
          />
          <p className="text-xs text-ink-500">
            {data.gerador === "ia" ? "Escrita pela IA e conferida contra os dados do lead." : "Modelo seguro (sem IA): usa só os dados do lead."} Revise antes de enviar.
          </p>
          {data.substituicoes.length > 0 && (
            <details className="text-xs text-ink-600">
              <summary className="cursor-pointer">Algumas versões da IA foram trocadas pelo modelo seguro</summary>
              <ul className="mt-1 list-disc pl-5">{data.substituicoes.map((s) => <li key={s}>{s}</li>)}</ul>
            </details>
          )}
          <div className="flex flex-wrap gap-2">
            {isWhats &&
              (telefone ? (
                <a
                  href={whatsappLink(telefone, texts[tab])}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="whatsapp-link"
                  onClick={() => messageId && markMessageSentAction(messageId, texts[tab])}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-600 px-4 text-[15px] font-semibold text-white hover:bg-emerald-700"
                >
                  Abrir no WhatsApp
                </a>
              ) : (
                <Alert tone="warning">Este negócio não tem telefone público. Use o e-mail ou outra forma de contato.</Alert>
              ))}
            {tab === "email" && emailPublico && (
              <a
                href={`mailto:${emailPublico}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texts.email)}`}
                onClick={() => messageId && markMessageSentAction(messageId, texts.email)}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-brand-600 px-4 text-[15px] font-semibold text-white"
              >
                Abrir e-mail
              </a>
            )}
            <Button variant="secondary" onClick={copy}>
              Copiar
            </Button>
            <Button variant="ghost" onClick={generate} disabled={pending}>
              {pending ? "Gerando…" : "Gerar de novo"}
            </Button>
          </div>
          {tab === "email" && !emailPublico && <p className="text-sm text-ink-600">E-mail de {nomeNegocio}: não disponível. Copie o texto se encontrar o e-mail no site do negócio.</p>}
          <div className="border-t border-ink-200 pt-3">
            <Button
              variant="secondary"
              className="w-full"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await markContactedAction(leadId);
                  if (r.error) setError(r.error);
                  else setInfo(r.ok ?? null);
                })
              }
            >
              Já enviei: marcar como contatado
            </Button>
          </div>
        </>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      {info && <Alert tone="success">{info}</Alert>}
    </div>
  );
}
