import { rejectRemovalAction } from "@/app/actions/admin";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { AdjustCreditsForm, SetPlanForm } from "./forms";

export const metadata = { title: "Administração" };

export default async function AdminPage() {
  await requireAdmin();
  const db = sql();
  const [usage, quota, removals, failed, audit, totals, emails] = await Promise.all([
    db<{ dia: string; servico: string; n: number; falhas: number }[]>`
      select to_char(created_at::date, 'DD/MM') as dia, servico, count(*)::int as n, count(*) filter (where not sucesso)::int as falhas
      from api_usage where created_at > now() - interval '7 days' group by created_at::date, servico order by created_at::date desc, servico`,
    db<{ provider: string; usadas: number; limite: number }[]>`select provider, usadas, limite from provider_quotas where dia = current_date`,
    db<{ id: string; nome_empresa: string; telefone_final: string | null; cidade: string | null; status: string; leads_afetados: number; created_at: Date }[]>`
      select id, nome_empresa, telefone_final, cidade, status, leads_afetados, created_at from removal_requests order by created_at desc limit 50`,
    db<{ id: string; nicho: string; erro_codigo: string | null; erro_msg: string | null; created_at: Date }[]>`
      select id, nicho, erro_codigo, erro_msg, created_at from searches where status = 'erro' order by created_at desc limit 20`,
    db<{ id: number; acao: string; alvo_tipo: string | null; dados: object; created_at: Date; email: string | null }[]>`
      select a.id, a.acao, a.alvo_tipo, a.dados, a.created_at, u.email from audit_log a left join users u on u.id = a.ator_id order by a.created_at desc limit 30`,
    db<{ usuarios: number; buscas_hoje: number; leads_hoje: number }[]>`
      select (select count(*)::int from users) as usuarios,
        (select count(*)::int from searches where created_at::date = current_date) as buscas_hoje,
        (select count(*)::int from leads where created_at::date = current_date) as leads_hoje`,
    db<{ status: string; n: number }[]>`select status, count(*)::int as n from outbox_emails where created_at > now() - interval '7 days' group by status`,
  ]);
  const t = totals[0]!;

  return (
    <div className="space-y-4">
      <PageHeader title="Administração" subtitle="Toda ação aqui fica registrada na auditoria." />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card className="p-3"><p className="text-sm text-ink-600">Usuários</p><p className="text-2xl font-bold">{t.usuarios}</p></Card>
        <Card className="p-3"><p className="text-sm text-ink-600">Buscas hoje</p><p className="text-2xl font-bold">{t.buscas_hoje}</p></Card>
        <Card className="p-3"><p className="text-sm text-ink-600">Leads hoje</p><p className="text-2xl font-bold">{t.leads_hoje}</p></Card>
        <Card className="p-3">
          <p className="text-sm text-ink-600">Cota do provedor hoje</p>
          <p className="text-2xl font-bold">{quota.map((q) => `${q.usadas}/${q.limite}`).join(" · ") || "0"}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card><h2 className="mb-3 text-lg font-bold">Ajustar créditos</h2><AdjustCreditsForm /></Card>
        <Card><h2 className="mb-3 text-lg font-bold">Plano do usuário</h2><SetPlanForm /></Card>
      </div>

      <Card>
        <h2 className="mb-3 text-lg font-bold">Pedidos de remoção de empresa</h2>
        {removals.length === 0 ? <p className="text-ink-600">Nenhum pedido.</p> : (
          <ul className="divide-y divide-ink-100">
            {removals.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-semibold">{r.nome_empresa}</span> · final {r.telefone_final ?? "—"} {r.cidade && `· ${r.cidade}`}
                  <span className="block text-sm text-ink-600">{r.created_at.toLocaleString("pt-BR")} · {r.leads_afetados} lead(s) retirados</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge className={r.status === "rejeitado" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}>{r.status === "aplicado" ? "Bloqueado" : "Desfeito"}</Badge>
                  {r.status === "aplicado" && (
                    <form action={rejectRemovalAction.bind(null, r.id)}>
                      <button className="min-h-11 rounded-xl px-3 text-sm font-semibold text-red-700 hover:bg-red-50">Desfazer (abuso)</button>
                    </form>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-bold">Uso de APIs (7 dias)</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-ink-600"><tr><th className="py-1">Dia</th><th>Serviço</th><th className="text-right">Chamadas</th><th className="text-right">Falhas</th></tr></thead>
            <tbody>{usage.map((u) => <tr key={`${u.dia}${u.servico}`} className="border-t border-ink-100"><td className="py-1">{u.dia}</td><td>{u.servico}</td><td className="text-right">{u.n}</td><td className="text-right">{u.falhas}</td></tr>)}</tbody>
          </table>
          <p className="mt-2 text-xs text-ink-500">E-mails (7 dias): {emails.map((e) => `${e.status} ${e.n}`).join(" · ") || "nenhum"}</p>
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-bold">Buscas com erro (sem cobrança)</h2>
          {failed.length === 0 ? <p className="text-ink-600">Nenhuma.</p> : (
            <ul className="space-y-1 text-sm">{failed.map((f) => <li key={f.id}><strong>{f.nicho}</strong> · {f.erro_codigo}: {f.erro_msg} · {f.created_at.toLocaleString("pt-BR")}</li>)}</ul>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-lg font-bold">Auditoria</h2>
        <ul className="space-y-1 text-sm">
          {audit.map((a) => <li key={a.id}>{a.created_at.toLocaleString("pt-BR")} · <strong>{a.acao}</strong> · {a.email ?? "sistema"} · <code className="text-xs">{JSON.stringify(a.dados)}</code></li>)}
        </ul>
      </Card>
    </div>
  );
}
