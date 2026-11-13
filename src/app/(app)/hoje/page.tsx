import Link from "next/link";
import { completeFollowupAction } from "@/app/actions/leads";
import { LeadCard as LeadCardView } from "@/components/lead-card";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db";
import { leadCardSelect, loadWorkspace, type LeadCard } from "@/lib/queries";

export const metadata = { title: "Hoje" };

export default async function TodayPage() {
  const user = await requireUser();
  const { ws, due, hot, stats } = await withUser(user.id, async (tx) => {
    const due = await tx<(LeadCard & { followup_id: string; vence_em: string })[]>`
      select c.*, f.id as followup_id, to_char(f.vence_em, 'YYYY-MM-DD') as vence_em
      from followups f join (${leadCardSelect(tx)}) c on c.id = f.lead_id
      where f.concluido_em is null and f.vence_em <= current_date
      order by f.vence_em, c.score desc limit 30`;
    const hot = await tx<LeadCard[]>`
      ${leadCardSelect(tx)} and l.descartado_em is null and l.ultima_interacao_em is null
      and (l.stage_id is null or l.stage_id in (select id from pipeline_stages where tipo = 'aberto'))
      order by l.score desc, l.created_at desc limit 6`;
    const [stats] = await tx<{ leads: number; contatados: number; fechados: number }[]>`
      select count(*)::int as leads,
        count(*) filter (where l.ultima_interacao_em is not null)::int as contatados,
        count(*) filter (where s.tipo = 'ganho')::int as fechados
      from leads l left join pipeline_stages s on s.id = l.stage_id where l.bloqueado_em is null`;
    return { ws: await loadWorkspace(tx), due, hot, stats: stats! };
  });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Olá, ${user.nome.split(" ")[0]}!`} subtitle="O que fazer hoje, em ordem de prioridade." />

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Créditos", ws.saldo],
          ["Leads", stats.leads],
          ["Contatados", stats.contatados],
          ["Fechados", stats.fechados],
        ].map(([label, n]) => (
          <Card key={label as string} className="p-3">
            <p className="text-sm text-ink-600">{label}</p>
            <p className="text-2xl font-bold tabular-nums">{n}</p>
          </Card>
        ))}
      </div>

      <h2 className="mb-2 text-lg font-bold">Follow-ups para hoje</h2>
      {due.length === 0 ? (
        <p className="mb-6 rounded-xl bg-white px-4 py-3 text-ink-600">Nenhum follow-up vencido. 👏</p>
      ) : (
        <ul className="mb-6 space-y-3">
          {due.map((d) => (
            <li key={d.followup_id}>
              <LeadCardView lead={d}>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className={d.vence_em < today ? "text-sm font-semibold text-red-700" : "text-sm font-semibold text-brand-700"}>
                    {d.vence_em < today ? `Vencido em ${new Date(`${d.vence_em}T12:00:00`).toLocaleDateString("pt-BR")}` : "Vence hoje"}
                  </span>
                  <div className="flex gap-2">
                    <form action={completeFollowupAction.bind(null, d.followup_id)}>
                      <button className="min-h-11 rounded-xl px-3 text-sm font-semibold text-ink-700 hover:bg-ink-100">Concluir</button>
                    </form>
                    <Link href={`/leads/${d.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white">
                      Gerar mensagem
                    </Link>
                  </div>
                </div>
              </LeadCardView>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-2 text-lg font-bold">Leads quentes ainda não contatados</h2>
      {hot.length === 0 ? (
        <EmptyState title="Nenhum lead esperando contato" action={<LinkButton href="/buscar">Buscar leads</LinkButton>}>
          Faça uma busca para encontrar novos clientes.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {hot.map((l) => (
            <li key={l.id}>
              <LeadCardView lead={l}>
                <Link href={`/leads/${l.id}`} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand-600 text-sm font-semibold text-white">
                  Abordar
                </Link>
              </LeadCardView>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
