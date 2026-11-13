import Link from "next/link";
import { LeadCard as LeadCardView } from "@/components/lead-card";
import { EmptyState, Input, LinkButton, PageHeader, Select, cx } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db";
import { leadCardSelect, type LeadCard } from "@/lib/queries";
import { Kanban } from "./kanban";

export const metadata = { title: "CRM" };

export default async function CrmPage({ searchParams }: { searchParams: Promise<{ q?: string; temp?: string; tag?: string; cidade?: string; etapa?: string; view?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 80) ?? "";
  const temp = ["quente", "morno", "frio"].includes(sp.temp ?? "") ? sp.temp! : "";
  const tag = sp.tag?.trim().slice(0, 30) ?? "";
  const cidade = sp.cidade?.trim().slice(0, 80) ?? "";
  const view = sp.view === "lista" ? "lista" : "quadro";

  const { stages, leads, tags } = await withUser(user.id, async (tx) => {
    const stages = await tx<{ id: string; nome: string; tipo: string }[]>`select id, nome, tipo from pipeline_stages order by ordem`;
    const leads = await tx<LeadCard[]>`
      ${leadCardSelect(tx)} and l.no_crm and l.descartado_em is null
      ${q ? tx`and b.nome ilike ${`%${q}%`}` : tx``}
      ${temp ? tx`and l.temperatura = ${temp}` : tx``}
      ${cidade ? tx`and b.cidade ilike ${`%${cidade}%`}` : tx``}
      ${sp.etapa && /^[0-9a-f-]{36}$/.test(sp.etapa) ? tx`and l.stage_id = ${sp.etapa}` : tx``}
      ${tag ? tx`and exists (select 1 from lead_tags lt join tags t on t.id = lt.tag_id where lt.lead_id = l.id and t.nome = ${tag})` : tx``}
      order by l.score desc limit 500`;
    const tags = await tx<{ nome: string }[]>`select nome from tags order by nome`;
    return { stages, leads, tags };
  });

  const params = (over: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(temp && { temp }), ...(tag && { tag }), ...(cidade && { cidade }), view, ...over });
    return `/crm?${p.toString()}`;
  };
  const hasFilter = Boolean(q || temp || tag || cidade || sp.etapa);

  return (
    <div>
      <PageHeader
        title="CRM"
        subtitle={`${leads.length} lead${leads.length === 1 ? "" : "s"}${hasFilter ? " com esses filtros" : ""}`}
        action={
          <div className="flex rounded-xl border border-ink-200 bg-white p-1 text-sm font-semibold" role="group" aria-label="Modo de visualização">
            <Link href={params({ view: "quadro" })} aria-current={view === "quadro" ? "page" : undefined} className={cx("rounded-lg px-3 py-2", view === "quadro" ? "bg-brand-600 text-white" : "text-ink-700")}>Quadro</Link>
            <Link href={params({ view: "lista" })} aria-current={view === "lista" ? "page" : undefined} className={cx("rounded-lg px-3 py-2", view === "lista" ? "bg-brand-600 text-white" : "text-ink-700")}>Lista</Link>
          </div>
        }
      />
      <form className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_140px_140px_140px_auto]" role="search">
        <input type="hidden" name="view" value={view} />
        <Input name="q" defaultValue={q} placeholder="Buscar por nome" aria-label="Buscar por nome" className="col-span-2 sm:col-span-1" />
        <Select name="temp" defaultValue={temp} aria-label="Temperatura">
          <option value="">Toda nota</option>
          <option value="quente">Quentes</option>
          <option value="morno">Mornos</option>
          <option value="frio">Frios</option>
        </Select>
        <Select name="tag" defaultValue={tag} aria-label="Etiqueta">
          <option value="">Toda etiqueta</option>
          {tags.map((t) => <option key={t.nome} value={t.nome}>{t.nome}</option>)}
        </Select>
        <Input name="cidade" defaultValue={cidade} placeholder="Cidade" aria-label="Cidade" />
        <button className="min-h-11 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white">Filtrar</button>
      </form>

      {leads.length === 0 ? (
        hasFilter ? (
          <EmptyState title="Nenhum lead com esses filtros" action={<LinkButton href="/crm" variant="secondary">Limpar filtros</LinkButton>} />
        ) : (
          <EmptyState title="Seu CRM está vazio" action={<LinkButton href="/buscar">Buscar leads</LinkButton>}>
            Faça uma busca e envie os melhores leads para o CRM para acompanhar cada conversa até fechar.
          </EmptyState>
        )
      ) : view === "quadro" ? (
        <Kanban stages={stages} leads={leads} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {leads.map((l) => (
            <li key={l.id}>
              <LeadCardView lead={l}>
                <p className="mt-2 text-sm font-semibold text-ink-700">Etapa: {stages.find((s) => s.id === l.stage_id)?.nome ?? "—"}</p>
              </LeadCardView>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
