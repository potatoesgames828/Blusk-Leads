import { describe, expect, it } from "vitest";
import { cadenceDates, CrmError, moveLead, sendToCrm } from "@/lib/crm";
import { sql, withUser } from "@/lib/db";
import { phoneHash } from "@/lib/phone-hash";
import { FakeProvider } from "@/lib/providers/fake";
import { rejectRemoval, submitRemoval } from "@/lib/removal";
import { createSearch, runSearch } from "@/lib/search/run";
import { makeUser } from "./helpers";

async function userWithLeads(nicho: string, cidade: string) {
  const u = await makeUser({ plano: "pago", creditos: 100 });
  const id = await createSearch(sql(), u.userId, u.workspaceId, { nicho, cidade, uf: "SP", filtro: "qualquer", pedidos: 5 });
  await runSearch(sql(), id, new FakeProvider());
  const leads = await sql()<{ id: string; business_id: string }[]>`select id, business_id from leads where search_id = ${id}`;
  return { ...u, leadIds: leads.map((l) => l.id), businessIds: leads.map((l) => l.business_id) };
}

describe("isolamento entre contas (RLS)", () => {
  it("um usuário nunca vê nem altera dados de outro", async () => {
    const a = await userWithLeads("barbearia", "Santos");
    const b = await userWithLeads("barbearia", "Sorocaba");

    await withUser(a.userId, async (tx) => {
      const leads = await tx`select id from leads`;
      expect(leads.map((l) => l.id).sort()).toEqual([...a.leadIds].sort());
      expect(await tx`select * from leads where id = ${b.leadIds[0]!}`).toHaveLength(0);
      expect(await tx`select * from businesses where id = ${b.businessIds[0]!}`).toHaveLength(0);
      expect(await tx`select * from credit_ledger where workspace_id = ${b.workspaceId}`).toHaveLength(0);
      expect(await tx`select * from searches where workspace_id = ${b.workspaceId}`).toHaveLength(0);
      expect(await tx`select * from workspace_settings where workspace_id = ${b.workspaceId}`).toHaveLength(0);
      const upd = await tx`update leads set valor_estimado_centavos = 1 where id = ${b.leadIds[0]!} returning id`;
      expect(upd).toHaveLength(0);
      await expect(tx`delete from leads where id = ${b.leadIds[0]!}`).resolves.toHaveLength(0);
    });

    // Tentar inserir dado na conta do outro é bloqueado pela política.
    await expect(
      withUser(a.userId, (tx) => tx`insert into tags (workspace_id, nome) values (${b.workspaceId}, 'invasao')`),
    ).rejects.toThrow(/row-level security/);
  });

  it("o papel da aplicação não pode mexer em créditos nem em tabelas do sistema", async () => {
    const a = await makeUser();
    await expect(withUser(a.userId, (tx) => tx`update credit_balances set saldo = 9999`)).rejects.toThrow(/permission denied/);
    await expect(withUser(a.userId, (tx) => tx`select * from sessions`)).rejects.toThrow(/permission denied/);
    await expect(withUser(a.userId, (tx) => tx`select password_hash from users`)).rejects.toThrow(/permission denied/);
    await expect(
      withUser(a.userId, (tx) => tx`select app.credit_apply(${a.workspaceId}, 100, 'bonus', 'x', null, null, 'hack', null)`),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("CRM", () => {
  it("mover de etapa grava evento, persiste e cria a cadência ao contatar", async () => {
    const a = await userWithLeads("lavanderia", "Campinas");
    const leadId = a.leadIds[0]!;
    await withUser(a.userId, async (tx) => {
      expect(await sendToCrm(tx, [leadId], a.userId)).toBe(1);
      const [contatado] = await tx<{ id: string }[]>`select id from pipeline_stages where chave = 'contatado'`;
      await moveLead(tx, { leadId, stageId: contatado!.id, userId: a.userId });
    });
    await withUser(a.userId, async (tx) => {
      const [lead] = await tx<{ chave: string }[]>`select s.chave from leads l join pipeline_stages s on s.id = l.stage_id where l.id = ${leadId}`;
      expect(lead!.chave).toBe("contatado");
      const ev = await tx<{ tipo: string; de: string | null; para: string }[]>`select tipo, de, para from lead_events where lead_id = ${leadId} and tipo = 'etapa'`;
      expect(ev).toEqual([{ tipo: "etapa", de: "Novo", para: "Contatado" }]);
      const fu = await tx<{ vence_em: Date }[]>`select vence_em from followups where lead_id = ${leadId} order by vence_em`;
      expect(fu.map((f) => f.vence_em.toISOString().slice(0, 10))).toEqual(cadenceDates(new Date(), [3, 5, 7]));
    });
  });

  it("marcar como perdido exige motivo e encerra follow-ups", async () => {
    const a = await userWithLeads("lavanderia", "Jundiaí");
    const leadId = a.leadIds[0]!;
    await withUser(a.userId, async (tx) => {
      await sendToCrm(tx, [leadId], a.userId);
      const [perdido] = await tx<{ id: string }[]>`select id from pipeline_stages where chave = 'perdido'`;
      await expect(moveLead(tx, { leadId, stageId: perdido!.id, userId: a.userId })).rejects.toBeInstanceOf(CrmError);
    });
    await withUser(a.userId, async (tx) => {
      const [perdido] = await tx<{ id: string }[]>`select id from pipeline_stages where chave = 'perdido'`;
      await moveLead(tx, { leadId, stageId: perdido!.id, userId: a.userId, motivoPerda: "preco" });
      const [l] = await tx<{ motivo_perda: string }[]>`select motivo_perda from leads where id = ${leadId}`;
      expect(l!.motivo_perda).toBe("preco");
    });
  });

  it("não move lead de outra conta", async () => {
    const a = await userWithLeads("chaveiro", "Osasco");
    const b = await userWithLeads("chaveiro", "Barueri");
    await withUser(a.userId, async (tx) => {
      const [st] = await tx<{ id: string }[]>`select id from pipeline_stages where chave = 'qualificado'`;
      await expect(moveLead(tx, { leadId: b.leadIds[0]!, stageId: st!.id, userId: a.userId })).rejects.toBeInstanceOf(CrmError);
    });
  });
});

describe("Remover minha empresa", () => {
  it("tira o negócio de todas as contas e de buscas futuras; admin pode desfazer", async () => {
    const a = await userWithLeads("vidraçaria", "Bauru");
    const [biz] = await sql()<{ id: string; telefone_e164: string }[]>`
      select b.id, b.telefone_e164 from businesses b join leads l on l.business_id = b.id
      where l.workspace_id = ${a.workspaceId} and b.telefone_e164 is not null limit 1`;
    const phone = biz!.telefone_e164.replace("+55", "");
    const { id, leadsAfetados } = await submitRemoval(sql(), { nomeEmpresa: "Vidraçaria", telefone: phone });
    expect(leadsAfetados).toBe(1);

    const [lead] = await sql()<{ bloqueado_em: Date | null }[]>`select bloqueado_em from leads where business_id = ${biz!.id}`;
    expect(lead!.bloqueado_em).not.toBeNull();
    const [blocked] = await sql()`select 1 from blocked_businesses where telefone_hash = ${phoneHash(biz!.telefone_e164)} and ativo`;
    expect(blocked).toBeTruthy();

    // Outra conta buscando o mesmo nicho/cidade nunca recebe essa empresa.
    await sql()`delete from lead_reservations where workspace_id = ${a.workspaceId}`;
    const b = await makeUser({ plano: "pago", creditos: 100 });
    const sid = await createSearch(sql(), b.userId, b.workspaceId, { nicho: "vidraçaria", cidade: "Bauru", uf: "SP", filtro: "qualquer", pedidos: 30 });
    await runSearch(sql(), sid, new FakeProvider());
    const got = await sql()`select 1 from leads where workspace_id = ${b.workspaceId} and business_id = ${biz!.id}`;
    expect(got).toHaveLength(0);
    const [s] = await sql()<{ descartados: Record<string, number> }[]>`select descartados from searches where id = ${sid}`;
    expect(s!.descartados.bloqueado).toBeGreaterThanOrEqual(1);

    const admin = await makeUser();
    await rejectRemoval(sql(), id, admin.userId);
    const [lead2] = await sql()<{ bloqueado_em: Date | null }[]>`select bloqueado_em from leads where business_id = ${biz!.id} and workspace_id = ${a.workspaceId}`;
    expect(lead2!.bloqueado_em).toBeNull();
  });
});
