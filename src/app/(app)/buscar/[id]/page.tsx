import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db";
import { OFFER_FILTERS } from "@/lib/filters";
import { leadCardSelect, type LeadCard } from "@/lib/queries";
import { SearchProgress } from "./progress";
import { SearchResults } from "./results";

export const metadata = { title: "Resultado da busca" };

const DISCARD_LABELS: Record<string, string> = {
  repetido: "já estavam na sua conta",
  reservado: "estão reservados para outro usuário",
  bloqueado: "pediram para não ser contatados",
  nicho_excluido: "são de nichos que você excluiu",
  fora_do_filtro: "não passaram no filtro escolhido",
  fechado: "estão fechados",
};

export default async function SearchResultPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const data = await withUser(user.id, async (tx) => {
    const [s] = await tx<
      { id: string; nicho: string; cidade: string | null; uf: string | null; status: string; pedidos: number; entregues: number; aviso: string | null; erro_msg: string | null; descartados: Record<string, number>; filtro_oferta: string }[]
    >`select id, nicho, cidade, uf, status, pedidos, entregues, aviso, erro_msg, descartados, filtro_oferta from searches where id = ${id}`;
    if (!s) return null;
    const leads = await tx<LeadCard[]>`${leadCardSelect(tx)} and l.search_id = ${id} order by l.score desc, b.nome`;
    return { s, leads };
  });
  if (!data) notFound();
  const { s, leads } = data;
  const running = s.status === "na_fila" || s.status === "rodando";
  const discarded = Object.entries(s.descartados ?? {}).filter(([, n]) => n > 0);

  return (
    <div>
      <Link href="/buscar" className="text-sm font-semibold text-brand-700">← Nova busca</Link>
      <PageHeader
        title={`${s.nicho} · ${s.cidade ? `${s.cidade}${s.uf ? ` - ${s.uf}` : ""}` : "Brasil"}`}
        subtitle={`Filtro: ${OFFER_FILTERS[s.filtro_oferta as keyof typeof OFFER_FILTERS]?.nome ?? s.filtro_oferta} · do mais quente ao mais frio`}
      />
      {running ? (
        <SearchProgress id={s.id} pedidos={s.pedidos} />
      ) : (
        <div className="mb-4 space-y-2">
          {s.status === "erro" && (
            <Alert tone="error">
              A busca não funcionou{s.erro_msg ? ` (${s.erro_msg})` : ""}. <strong>Nenhum crédito foi cobrado.</strong> Tente de novo em alguns minutos.
            </Alert>
          )}
          {s.status === "concluida" && <Alert tone="success">{s.entregues} leads novos entregues. Cobramos {s.entregues} créditos.</Alert>}
          {s.status === "parcial" && s.aviso && <Alert tone="warning">{s.aviso}</Alert>}
          {discarded.length > 0 && (
            <p className="text-sm text-ink-600">
              Deixamos de fora (sem cobrar):{" "}
              {discarded.map(([k, n], i) => (
                <span key={k}>
                  {i > 0 && "; "}
                  {n} que {DISCARD_LABELS[k] ?? k}
                </span>
              ))}
              .
            </p>
          )}
        </div>
      )}
      {!running &&
        (leads.length === 0 ? (
          <EmptyState title="Nenhum lead novo nesta busca" action={<LinkButton href="/buscar">Tentar outra busca</LinkButton>}>
            Experimente outro nicho, outra cidade ou o filtro “Qualquer negócio ativo”.
          </EmptyState>
        ) : (
          <SearchResults leads={leads} />
        ))}
    </div>
  );
}
