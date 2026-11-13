import "server-only";
import postgres from "postgres";

export type Sql = postgres.Sql;
export type Tx = postgres.TransactionSql;

declare global {
  var __bluskSql: postgres.Sql | undefined;
}

/** Conexão com o papel dono. Use só em código de sistema (auth, busca, créditos, admin). */
export function sql(): postgres.Sql {
  if (!globalThis.__bluskSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não configurada");
    globalThis.__bluskSql = postgres(url, {
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idle_timeout: 20,
      onnotice: () => {},
      transform: { undefined: null },
    });
  }
  return globalThis.__bluskSql;
}

/**
 * Executa `fn` numa transação com o papel restrito `blusk_app` e o usuário atual definido.
 * Toda leitura/escrita de dados do usuário deve passar por aqui: a RLS do Postgres
 * garante que um usuário nunca enxerga dados de outro, mesmo com bug na aplicação.
 */
export async function withUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return sql().begin(async (tx) => {
    await tx`select set_config('app.user_id', ${userId}, true)`;
    await tx`set local role blusk_app`;
    return fn(tx);
  }) as Promise<T>;
}
