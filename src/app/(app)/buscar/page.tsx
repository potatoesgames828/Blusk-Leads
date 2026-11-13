import Link from "next/link";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db";
import { defaultFilterForOffers, OFFER_FILTERS } from "@/lib/filters";
import { loadProfile, loadWorkspace } from "@/lib/queries";
import { SearchForm } from "./search-form";

export const metadata = { title: "Buscar leads" };

const STATUS: Record<string, string> = {
  na_fila: "Na fila",
  rodando: "Buscando…",
  concluida: "Concluída",
  parcial: "Parcial",
  erro: "Erro (sem custo)",
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ bemvindo?: string }> }) {
  const user = await requireUser();
  const { bemvindo } = await searchParams;
  const { profile, ws, recent } = await withUser(user.id, async (tx) => ({
    profile: await loadProfile(tx),
    ws: await loadWorkspace(tx),
    recent: await tx<{ id: string; nicho: string; cidade: string | null; uf: string | null; status: string; entregues: number; pedidos: number; created_at: Date; filtro_oferta: string }[]>`
      select id, nicho, cidade, uf, status, entregues, pedidos, created_at, filtro_oferta from searches order by created_at desc limit 10`,
  }));

  const cidadePadrao = profile.regiao.tipo === "cidade" && profile.regiao.cidade ? `${profile.regiao.cidade}${profile.regiao.uf ? ` - ${profile.regiao.uf}` : ""}` : "";

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Buscar leads" subtitle="Empresas reais, filtradas pelo que você vende." />
      {bemvindo && (
        <div className="mb-4">
          <Alert tone="success">
            Conta pronta! Você tem <strong>{ws.saldo} créditos</strong> do teste grátis. Cada lead novo custa 1 crédito; repetidos e
            buscas com erro não são cobrados.
          </Alert>
        </div>
      )}
      <Card>
        <SearchForm
          plano={ws.plano}
          saldo={ws.saldo}
          defaultFiltro={defaultFilterForOffers(profile.ofertas)}
          defaultCidade={cidadePadrao}
          defaultNicho={profile.nichos_aceitos[0] ?? ""}
        />
      </Card>

      <h2 className="mb-2 mt-8 text-lg font-bold">Buscas recentes</h2>
      {recent.length === 0 ? (
        <p className="text-ink-600">Suas buscas vão aparecer aqui.</p>
      ) : (
        <ul className="space-y-2">
          {recent.map((s) => (
            <li key={s.id}>
              <Link href={`/buscar/${s.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3 hover:border-brand-200">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {s.nicho} · {s.cidade ? `${s.cidade}${s.uf ? ` - ${s.uf}` : ""}` : "Brasil"}
                  </span>
                  <span className="text-sm text-ink-600">
                    {OFFER_FILTERS[s.filtro_oferta as keyof typeof OFFER_FILTERS]?.nome} · {s.entregues} de {s.pedidos} leads ·{" "}
                    {s.created_at.toLocaleDateString("pt-BR")}
                  </span>
                </span>
                <Badge className={s.status === "erro" ? "bg-red-50 text-red-800" : undefined}>{STATUS[s.status] ?? s.status}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
