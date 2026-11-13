import postgres from "postgres";
import { migrate } from "../src/lib/migrate";

/** Recria o banco de teste do zero e aplica as migrações. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://blusk_owner:blusk@localhost:5432/blusk_test";
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe("drop schema if exists public cascade; drop schema if exists app cascade; create schema public;");
  } catch (err) {
    console.warn("Banco de teste indisponível; testes de banco vão falhar.", (err as Error).message);
    await sql.end();
    return;
  }
  await sql.end();
  await migrate(url, () => {});
}
