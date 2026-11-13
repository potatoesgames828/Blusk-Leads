import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Aprender" };

const trilhas = [
  { t: "Como prospectar e abordar", d: "Escolher nicho, ler o recibo do score e escrever a primeira mensagem." },
  { t: "Como fechar e precificar", d: "Da primeira conversa à proposta aceita." },
  { t: "Fundamentos de motion graphics", d: "Do roteiro à exportação final." },
  { t: "Como entregar e revisar com o cliente", d: "Rodadas de revisão sem dor de cabeça." },
];

export default function LearnPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Aprender" subtitle="Trilhas curtas para vender e entregar melhor. As aulas chegam em breve." />
      <ul className="space-y-3">
        {trilhas.map((x) => (
          <li key={x.t}>
            <Card>
              <p className="font-semibold">{x.t}</p>
              <p className="text-[15px] text-ink-600">{x.d}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Em breve</p>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
