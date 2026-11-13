"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { formString, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/auth/session";
import { parseCityInput } from "@/lib/br";
import { discardLeads, sendToCrm } from "@/lib/crm";
import { sql, withUser } from "@/lib/db";
import { OFFER_FILTERS, type OfferFilter } from "@/lib/filters";
import { rateLimit } from "@/lib/rate-limit";
import { createSearch, runSearch, SearchInputError } from "@/lib/search/run";

export async function createSearchAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!(await rateLimit(sql(), `search:${user.id}`, 30, 3600))) {
    return { error: "Você fez muitas buscas na última hora. Aguarde um pouco e tente de novo." };
  }
  const filtro = formString(fd, "filtro") as OfferFilter;
  const { cidade, uf } = parseCityInput(formString(fd, "cidade"));
  let id: string;
  try {
    id = await createSearch(sql(), user.id, user.workspaceId, {
      nicho: formString(fd, "nicho"),
      cidade,
      uf,
      filtro: filtro in OFFER_FILTERS ? filtro : "qualquer",
      pedidos: Number(formString(fd, "pedidos")),
    });
  } catch (err) {
    if (err instanceof SearchInputError) return { error: err.message };
    throw err;
  }
  // A busca roda depois da resposta (a tela acompanha o progresso).
  after(() => runSearch(sql(), id));
  redirect(`/buscar/${id}`);
}

export async function sendToCrmAction(ids: string[]): Promise<ActionState> {
  const user = await requireUser();
  const n = await withUser(user.id, (tx) => sendToCrm(tx, ids.slice(0, 100), user.id));
  revalidatePath("/buscar", "layout");
  revalidatePath("/crm");
  return { ok: n === 1 ? "1 lead enviado para o CRM." : `${n} leads enviados para o CRM.` };
}

export async function discardAction(ids: string[]): Promise<ActionState> {
  const user = await requireUser();
  const n = await withUser(user.id, (tx) => discardLeads(tx, ids.slice(0, 100), user.id));
  revalidatePath("/buscar", "layout");
  revalidatePath("/crm");
  return { ok: n === 1 ? "1 lead descartado." : `${n} leads descartados.` };
}
