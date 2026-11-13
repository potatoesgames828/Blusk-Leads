import postgres from "postgres";
import { migrate } from "../../src/lib/migrate";

export default async function setup() {
  const url = process.env.E2E_DATABASE_URL ?? "postgres://blusk_owner:blusk@localhost:5432/blusk_e2e";
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe("drop schema if exists public cascade; drop schema if exists app cascade; create schema public;");
  await sql.end();
  await migrate(url, () => {});
}
