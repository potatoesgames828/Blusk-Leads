"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { formString } from "@/lib/action-state";
import { requireUser } from "@/lib/auth/session";
import { parseCityInput } from "@/lib/br";
import { sql, withUser } from "@/lib/db";
import { OFFERS } from "@/lib/filters";
import { SCORE_RULES } from "@/lib/score/rules";

const offerIds = OFFERS.map((o) => o.id) as [string, ...string[]];

const listFromText = (s: string) =>
  [...new Set(s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean))].slice(0, 50).map((x) => x.slice(0, 60));

const ProfileSchema = z.object({
  ofertas: z.array(z.enum(offerIds)).min(1, "Escolha pelo menos um serviço."),
  nichos_aceitos: z.array(z.string()),
  nichos_excluidos: z.array(z.string()),
  porte: z.enum(["pequeno", "medio", "grande", "qualquer"]),
  regiao: z.enum(["brasil", "cidade"]),
  cidade: z.string().max(80),
  estilo_mensagem: z.enum(["formal", "amigavel", "direto"]),
  sobre_mim: z.string().max(600, "O texto sobre você pode ter até 600 caracteres."),
});

function parseProfile(fd: FormData) {
  return ProfileSchema.safeParse({
    ofertas: fd.getAll("ofertas").map(String),
    nichos_aceitos: listFromText(formString(fd, "nichos_aceitos")),
    nichos_excluidos: listFromText(formString(fd, "nichos_excluidos")),
    porte: formString(fd, "porte") || "qualquer",
    regiao: formString(fd, "regiao") || "brasil",
    cidade: formString(fd, "cidade"),
    estilo_mensagem: formString(fd, "estilo_mensagem") || "amigavel",
    sobre_mim: formString(fd, "sobre_mim").trim(),
  });
}

async function saveProfile(userId: string, p: z.infer<typeof ProfileSchema>) {
  const { cidade, uf } = p.regiao === "cidade" ? parseCityInput(p.cidade) : { cidade: null, uf: null };
  const regiao = cidade ? { tipo: "cidade", cidade, uf } : { tipo: "brasil" };
  await withUser(userId, async (tx) => {
    await tx`
      update workspace_settings set ofertas = ${p.ofertas}, nichos_aceitos = ${p.nichos_aceitos},
        nichos_excluidos = ${p.nichos_excluidos}, porte = ${p.porte}, regiao_padrao = ${tx.json(regiao)},
        estilo_mensagem = ${p.estilo_mensagem}, sobre_mim = ${p.sobre_mim}, updated_at = now()`;
  });
}

export async function onboardingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseProfile(fd);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados." };
  await saveProfile(user.id, parsed.data);
  await sql()`update workspaces set onboarding_concluido_em = coalesce(onboarding_concluido_em, now()) where id = ${user.workspaceId}`;
  redirect("/buscar?bemvindo=1");
}

export async function profileSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseProfile(fd);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados." };
  await saveProfile(user.id, parsed.data);
  revalidatePath("/ajustes");
  return { ok: "Preferências salvas." };
}

export async function cadenceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const dias = formString(fd, "cadencia")
    .split(/[,\s]+/)
    .map((x) => Number(x))
    .filter((n) => Number.isInteger(n));
  if (dias.length < 1 || dias.length > 6 || dias.some((n) => n < 1 || n > 60)) {
    return { error: "Informe de 1 a 6 intervalos entre 1 e 60 dias, separados por vírgula. Ex.: 3, 5, 7" };
  }
  await withUser(user.id, (tx) => tx`update workspace_settings set cadencia_followup = ${dias}, updated_at = now()`);
  revalidatePath("/ajustes");
  return { ok: "Cadência salva." };
}

export async function scoreWeightsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const reset = fd.get("restaurar") === "1";
  await withUser(user.id, async (tx) => {
    await tx`delete from workspace_score_weights where workspace_id = ${user.workspaceId}`;
    if (reset) return;
    for (const rule of SCORE_RULES) {
      const raw = formString(fd, `peso_${rule.chave}`);
      const n = Number(raw);
      if (raw === "" || !Number.isInteger(n) || n < -50 || n > 50) continue;
      if (n === rule.pesoPadrao) continue;
      await tx`insert into workspace_score_weights (workspace_id, regra, peso) values (${user.workspaceId}, ${rule.chave}, ${n})`;
    }
  });
  revalidatePath("/ajustes");
  return { ok: reset ? "Pesos padrão restaurados. Valem para as próximas buscas." : "Pesos salvos. Valem para as próximas buscas." };
}

export async function nameAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const nome = formString(fd, "nome").trim();
  if (nome.length < 2 || nome.length > 80) return { error: "Informe seu nome." };
  await withUser(user.id, (tx) => tx`update users set nome = ${nome} where id = ${user.id}`);
  revalidatePath("/ajustes");
  return { ok: "Nome atualizado." };
}

export async function stageRenameAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const updates: { id: string; nome: string; ordem: number }[] = [];
  for (const [k, v] of fd.entries()) {
    const m = /^stage_(.+)_nome$/.exec(k);
    if (!m) continue;
    const nome = String(v).trim();
    const ordem = Number(fd.get(`stage_${m[1]}_ordem`));
    if (nome.length < 1 || nome.length > 40) return { error: "Cada etapa precisa de um nome de até 40 caracteres." };
    updates.push({ id: m[1]!, nome, ordem });
  }
  const ordens = updates.map((u) => u.ordem);
  if (new Set(ordens).size !== ordens.length || ordens.some((o) => !Number.isInteger(o))) {
    return { error: "Cada etapa precisa de uma posição diferente." };
  }
  await withUser(user.id, async (tx) => {
    await tx`set constraints all deferred`;
    for (const u of updates) await tx`update pipeline_stages set nome = ${u.nome}, ordem = ${u.ordem} where id = ${u.id}`;
  });
  revalidatePath("/ajustes");
  revalidatePath("/crm");
  return { ok: "Etapas do CRM atualizadas." };
}
