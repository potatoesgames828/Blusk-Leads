import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

/** Aplica as migrações de db/migrations em ordem, uma única vez cada. */
export async function migrate(databaseUrl: string, log = console.log): Promise<string[]> {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  const applied: string[] = [];
  try {
    await sql`create table if not exists schema_migrations (nome text primary key, aplicada_em timestamptz not null default now())`;
    const dir = path.join(process.cwd(), "db", "migrations");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    const done = new Set((await sql<{ nome: string }[]>`select nome from schema_migrations`).map((r) => r.nome));
    for (const file of files) {
      if (done.has(file)) continue;
      const content = fs.readFileSync(path.join(dir, file), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(content);
        await tx`insert into schema_migrations(nome) values (${file})`;
      });
      log(`migração aplicada: ${file}`);
      applied.push(file);
    }
  } finally {
    await sql.end();
  }
  return applied;
}
