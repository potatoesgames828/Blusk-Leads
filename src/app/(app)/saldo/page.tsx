import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db";
import { loadWorkspace } from "@/lib/queries";

export const metadata = { title: "Meu saldo" };

const TIPO: Record<string, string> = {
  teste_gratis: "Teste grátis",
  bonus: "Bônus",
  cota_ciclo: "Cota do plano",
  compra: "Compra de créditos",
  reserva_busca: "Busca",
  estorno_busca: "Estorno",
  ajuste_admin: "Ajuste",
};

export default async function BalancePage() {
  const user = await requireUser();
  const { ws, rows } = await withUser(user.id, async (tx) => ({
    ws: await loadWorkspace(tx),
    rows: await tx<{ id: string; delta: number; tipo: string; motivo: string; saldo_antes: number; saldo_depois: number; created_at: Date }[]>`
      select id, delta, tipo, motivo, saldo_antes, saldo_depois, created_at from credit_ledger order by created_at desc, id desc limit 200`,
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Meu saldo" />
      <Card className="mb-4">
        <p className="text-sm text-ink-600">Saldo atual</p>
        <p className="text-4xl font-extrabold tabular-nums" data-testid="saldo">{ws.saldo} <span className="text-lg font-semibold text-ink-600">créditos</span></p>
        <p className="mt-1 text-sm text-ink-600">Plano: {ws.plano === "teste" ? "Teste grátis" : "Pago"} · 1 crédito por lead novo no Brasil</p>
        <div className="mt-4 rounded-xl bg-ink-100 px-3 py-2.5 text-[15px] text-ink-700">
          <strong>Planos e compra de créditos chegam em breve</strong> (Pix e cartão, cancelamento em poucos toques, sem fidelidade).
        </div>
      </Card>

      <h2 className="mb-2 text-lg font-bold">Extrato</h2>
      <p className="mb-3 text-sm text-ink-600">
        Ao buscar, reservamos os créditos do pedido. Ao terminar, devolvemos na hora o que não foi entregue (repetidos, fora do filtro ou erro).
      </p>
      <div className="relative overflow-x-auto rounded-2xl border border-ink-200 bg-white">
        <table className="w-full min-w-[520px] text-[15px]">
          <caption className="sr-only">Extrato de créditos</caption>
          <thead className="bg-ink-50 text-left text-sm text-ink-600">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">Data</th>
              <th scope="col" className="px-3 py-2 font-semibold">Motivo</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Créditos</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-3 py-2 text-sm text-ink-600">{r.created_at.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
                <td className="px-3 py-2">
                  <span className="font-semibold">{TIPO[r.tipo] ?? r.tipo}</span>
                  <span className="block text-sm text-ink-600">{r.motivo}</span>
                </td>
                <td className={`px-3 py-2 text-right font-semibold tabular-nums ${r.delta > 0 ? "text-emerald-700" : "text-ink-900"}`}>{r.delta > 0 ? `+${r.delta}` : r.delta}</td>
                <td className="px-3 py-2 text-right tabular-nums text-ink-600">
                  <span className="sr-only">de {r.saldo_antes} para </span>{r.saldo_depois}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
