import type { Sql, Tx } from "./db";

export type CreditType =
  | "teste_gratis" | "bonus" | "cota_ciclo" | "compra" | "reserva_busca" | "estorno_busca" | "ajuste_admin";

export interface LedgerEntry {
  id: string;
  workspace_id: string;
  delta: number;
  tipo: CreditType;
  motivo: string;
  saldo_antes: number;
  saldo_depois: number;
  idempotency_key: string;
  created_at: Date;
}

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Saldo de créditos insuficiente");
    this.name = "InsufficientCreditsError";
  }
}

/**
 * Lança um débito ou crédito no extrato. Idempotente pela chave: chamar duas vezes
 * com a mesma chave não cobra duas vezes. Deve ser chamado com a conexão de sistema.
 */
export async function applyCredit(
  db: Sql | Tx,
  p: {
    workspaceId: string;
    delta: number;
    tipo: CreditType;
    motivo: string;
    key: string;
    refTipo?: string;
    refId?: string;
    actorId?: string | null;
  },
): Promise<LedgerEntry> {
  try {
    const [row] = await db<LedgerEntry[]>`
      select * from app.credit_apply(${p.workspaceId}, ${p.delta}, ${p.tipo}, ${p.motivo},
        ${p.refTipo ?? null}, ${p.refId ?? null}, ${p.key}, ${p.actorId ?? null})`;
    return row!;
  } catch (err) {
    if ((err as { message?: string }).message?.includes("saldo_insuficiente")) throw new InsufficientCreditsError();
    throw err;
  }
}

export async function getBalance(db: Sql | Tx, workspaceId: string): Promise<number> {
  const [row] = await db<{ saldo: number }[]>`select saldo from credit_balances where workspace_id = ${workspaceId}`;
  return row?.saldo ?? 0;
}
