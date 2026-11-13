import { describe, expect, it } from "vitest";
import { applyCredit, InsufficientCreditsError } from "@/lib/credits";
import { sql } from "@/lib/db";
import { FakeProvider } from "@/lib/providers/fake";
import { ProviderError, type LeadProvider } from "@/lib/providers/types";
import { receiptIsConsistent, type ScoreReceipt } from "@/lib/score/engine";
import { createSearch, recoverStaleSearches, runSearch, SearchInputError } from "@/lib/search/run";
import { balance, makeUser } from "./helpers";

const db = () => sql();

async function search(userId: string, workspaceId: string, nicho: string, pedidos: number, provider?: LeadProvider, filtro: "qualquer" | "sem_site" = "qualquer", cidade = "Curitiba") {
  const id = await createSearch(db(), userId, workspaceId, { nicho, cidade, uf: "PR", filtro, pedidos });
  await runSearch(db(), id, provider ?? new FakeProvider());
  const [s] = await db()<{ status: string; entregues: number; aviso: string | null; descartados: Record<string, number>; erro_codigo: string | null }[]>`
    select status, entregues, aviso, descartados, erro_codigo from searches where id = ${id}`;
  return { id, ...s! };
}

async function ledger(workspaceId: string) {
  return db()<{ delta: number; tipo: string; saldo_antes: number; saldo_depois: number }[]>`
    select delta, tipo, saldo_antes, saldo_depois from credit_ledger where workspace_id = ${workspaceId} order by created_at, id`;
}

describe("créditos", () => {
  it("teste grátis dá 5 créditos sem cartão e registra no extrato", async () => {
    const u = await makeUser();
    expect(await balance(u.workspaceId)).toBe(5);
    const l = await ledger(u.workspaceId);
    expect(l).toEqual([{ delta: 5, tipo: "teste_gratis", saldo_antes: 0, saldo_depois: 5 }]);
  });

  it("a mesma chave nunca lança duas vezes (idempotência)", async () => {
    const u = await makeUser();
    const p = { workspaceId: u.workspaceId, delta: 10, tipo: "bonus" as const, motivo: "x", key: `k:${u.workspaceId}` };
    await applyCredit(db(), p);
    await applyCredit(db(), p);
    await Promise.all([applyCredit(db(), p), applyCredit(db(), p)]);
    expect(await balance(u.workspaceId)).toBe(15);
  });

  it("não deixa o saldo ficar negativo", async () => {
    const u = await makeUser();
    await expect(applyCredit(db(), { workspaceId: u.workspaceId, delta: -6, tipo: "ajuste_admin", motivo: "x", key: `neg:${u.workspaceId}` })).rejects.toBeInstanceOf(InsufficientCreditsError);
    expect(await balance(u.workspaceId)).toBe(5);
  });
});

describe("busca de leads e cobrança", () => {
  it("busca completa cobra exatamente os leads entregues, com recibo consistente", async () => {
    const u = await makeUser({ plano: "pago", creditos: 50 });
    const r = await search(u.userId, u.workspaceId, "padaria", 10);
    expect(r.status).toBe("concluida");
    expect(r.entregues).toBe(10);
    expect(await balance(u.workspaceId)).toBe(40);
    const leads = await db()<{ score: number; score_recibo: ScoreReceipt }[]>`select score, score_recibo from leads where search_id = ${r.id}`;
    expect(leads).toHaveLength(10);
    for (const l of leads) {
      expect(receiptIsConsistent(l.score_recibo)).toBe(true);
      expect(l.score_recibo.total).toBe(l.score);
    }
  });

  it("lead repetido não aparece duas vezes nem é cobrado", async () => {
    const u = await makeUser({ plano: "pago", creditos: 100 });
    await search(u.userId, u.workspaceId, "academia", 20);
    expect(await balance(u.workspaceId)).toBe(80);
    // O provedor fictício devolve os mesmos 30 negócios: só 10 são novos.
    const r2 = await search(u.userId, u.workspaceId, "academia", 20);
    expect(r2.status).toBe("parcial");
    expect(r2.descartados.repetido).toBe(20);
    expect(await balance(u.workspaceId)).toBe(80 - (r2.entregues));
    const [{ n }] = (await db()<{ n: number }[]>`select count(*)::int as n from leads where workspace_id = ${u.workspaceId}`) as [{ n: number }];
    expect(n).toBe(20 + r2.entregues);
    const [{ d }] = (await db()<{ d: number }[]>`select count(*)::int - count(distinct business_id)::int as d from leads where workspace_id = ${u.workspaceId}`) as [{ d: number }];
    expect(d).toBe(0);
  });

  it("busca com erro deixa o saldo exatamente igual e registra o motivo", async () => {
    const u = await makeUser({ plano: "pago", creditos: 30 });
    const r = await search(u.userId, u.workspaceId, "erro", 10);
    expect(r.status).toBe("erro");
    expect(r.erro_codigo).toBe("unknown");
    expect(await balance(u.workspaceId)).toBe(30);
    const l = await ledger(u.workspaceId);
    expect(l.slice(-2).map((x) => x.tipo)).toEqual(["reserva_busca", "estorno_busca"]);
  });

  it("falha no meio cobra só os entregues", async () => {
    const u = await makeUser({ plano: "pago", creditos: 60 });
    const fake = new FakeProvider();
    let calls = 0;
    const flaky: LeadProvider = {
      id: "fake",
      getDetails: () => fake.getDetails(),
      async searchPage(q, t) {
        if (calls++ === 1) throw new ProviderError("network", "caiu");
        return fake.searchPage(q, t);
      },
    };
    const r = await search(u.userId, u.workspaceId, "pizzaria", 40, flaky);
    expect(r.status).toBe("parcial");
    // Só a 1ª página (20 negócios, menos os fechados) foi entregue antes da falha.
    expect(r.entregues).toBeGreaterThan(0);
    expect(r.entregues).toBeLessThanOrEqual(20);
    expect(await balance(u.workspaceId)).toBe(60 - r.entregues);
  });

  it("nicho excluído nunca é mostrado nem cobrado", async () => {
    const u = await makeUser({ plano: "pago", creditos: 30, excluidos: ["advocacia"] });
    const r = await search(u.userId, u.workspaceId, "advogado", 10);
    expect(r.entregues).toBe(0);
    expect(r.descartados.nicho_excluido).toBeGreaterThan(0);
    expect(await balance(u.workspaceId)).toBe(30);
  });

  it("busca sem resultados não cobra nada", async () => {
    const u = await makeUser({ plano: "pago", creditos: 30 });
    const r = await search(u.userId, u.workspaceId, "vazio", 10);
    expect(r.status).toBe("parcial");
    expect(r.aviso).toContain("Você só pagou pelos entregues");
    expect(await balance(u.workspaceId)).toBe(30);
  });

  it("sem créditos suficientes a busca nem começa", async () => {
    const u = await makeUser();
    await expect(createSearch(db(), u.userId, u.workspaceId, { nicho: "padaria", cidade: null, uf: null, filtro: "qualquer", pedidos: 6 })).rejects.toBeInstanceOf(SearchInputError);
    expect(await balance(u.workspaceId)).toBe(5);
  });

  it("no teste grátis a busca é no Brasil todo (cidade ignorada)", async () => {
    const u = await makeUser();
    const id = await createSearch(db(), u.userId, u.workspaceId, { nicho: "padaria", cidade: "Recife", uf: "PE", filtro: "qualquer", pedidos: 5 });
    const [s] = await db()<{ cidade: string | null }[]>`select cidade from searches where id = ${id}`;
    expect(s!.cidade).toBeNull();
  });

  it("lead reservado para uma conta não é entregue a outra por 30 dias", async () => {
    const a = await makeUser({ plano: "pago", creditos: 100 });
    const b = await makeUser({ plano: "pago", creditos: 100 });
    const ra = await search(a.userId, a.workspaceId, "floricultura", 30, undefined, "qualquer", "Natal");
    const rb = await search(b.userId, b.workspaceId, "floricultura", 30, undefined, "qualquer", "Natal");
    expect(rb.entregues).toBe(0);
    expect(rb.descartados.reservado).toBe(ra.entregues);
    expect(await balance(b.workspaceId)).toBe(100);
    // Reserva vencida: o lead pode ir para outra conta.
    await db()`update lead_reservations set reservado_de = now() - interval '40 days', reservado_ate = now() - interval '10 days' where workspace_id = ${a.workspaceId}`;
    const rb2 = await search(b.userId, b.workspaceId, "floricultura", 5, undefined, "qualquer", "Natal");
    expect(rb2.entregues).toBe(5);
  });

  it("buscas simultâneas de contas diferentes nunca entregam o mesmo negócio duas vezes", async () => {
    const users = await Promise.all([1, 2, 3].map(() => makeUser({ plano: "pago", creditos: 100 })));
    const ids = await Promise.all(users.map((u) => createSearch(db(), u.userId, u.workspaceId, { nicho: "sorveteria", cidade: "Belém", uf: "PA", filtro: "qualquer", pedidos: 30 })));
    await Promise.all(ids.map((id) => runSearch(db(), id, new FakeProvider())));
    const [{ total, distintos }] = (await db()<{ total: number; distintos: number }[]>`
      select count(*)::int as total, count(distinct business_id)::int as distintos from leads where search_id = any(${ids}::uuid[])`) as [{ total: number; distintos: number }];
    expect(total).toBe(distintos);
    expect(total).toBeLessThanOrEqual(30);
    let saldoTotal = 0;
    for (const u of users) saldoTotal += await balance(u.workspaceId);
    expect(saldoTotal).toBe(300 - total);
  });

  it("busca presa é encerrada e estornada automaticamente", async () => {
    const u = await makeUser({ plano: "pago", creditos: 20 });
    const id = await createSearch(db(), u.userId, u.workspaceId, { nicho: "padaria", cidade: "Lages", uf: "SC", filtro: "qualquer", pedidos: 10 });
    expect(await balance(u.workspaceId)).toBe(10);
    await db()`update searches set created_at = now() - interval '1 hour' where id = ${id}`;
    await recoverStaleSearches(db());
    expect(await balance(u.workspaceId)).toBe(20);
    await runSearch(db(), id, new FakeProvider()); // não roda de novo
    expect(await balance(u.workspaceId)).toBe(20);
  });
});
