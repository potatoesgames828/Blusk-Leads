import { migrate } from "../src/lib/migrate";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL (veja .env.example)");
  process.exit(1);
}
migrate(url)
  .then((applied) => console.log(applied.length ? "Banco atualizado." : "Nenhuma migração pendente."))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
