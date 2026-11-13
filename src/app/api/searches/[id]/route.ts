import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db";

/** Status da busca para a tela acompanhar o progresso (RLS garante que só o dono vê). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });
  const row = await withUser(user.id, async (tx) => {
    const [s] = await tx<{ status: string; pedidos: number }[]>`select status, pedidos from searches where id = ${id}`;
    if (!s) return null;
    const { n } = (await tx<{ n: number }[]>`select count(*)::int as n from leads where search_id = ${id}`)[0]!;
    return { status: s.status, pedidos: s.pedidos, entregues: n };
  });
  if (!row) return NextResponse.json({ error: "não encontrada" }, { status: 404 });
  return NextResponse.json(row, { headers: { "Cache-Control": "no-store" } });
}
