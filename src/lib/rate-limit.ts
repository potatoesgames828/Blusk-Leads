import type { Sql } from "./db";

/**
 * Limite de requisições em janela fixa, guardado no Postgres (funciona com várias instâncias).
 * Retorna true se a requisição pode seguir.
 */
export async function rateLimit(db: Sql, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const [row] = await db<{ contagem: number }[]>`
    insert into rate_limits (chave, janela_inicio, contagem) values (${key}, now(), 1)
    on conflict (chave) do update set
      contagem = case when rate_limits.janela_inicio < now() - make_interval(secs => ${windowSeconds})
                      then 1 else rate_limits.contagem + 1 end,
      janela_inicio = case when rate_limits.janela_inicio < now() - make_interval(secs => ${windowSeconds})
                      then now() else rate_limits.janela_inicio end
    returning contagem`;
  return (row?.contagem ?? 0) <= limit;
}
