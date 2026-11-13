/**
 * Fatos verificáveis sobre um negócio. É a ÚNICA informação sobre o lead que a IA recebe,
 * e o verificador (guard.ts) recusa qualquer número que não esteja aqui.
 */
export interface Fact {
  chave: string;
  texto: string;
}

export interface FactInput {
  nome: string;
  categoria: string | null;
  cidade: string | null;
  site: string | null;
  redeSocial: string | null;
  nota: number | null;
  avaliacoes: number | null;
  telefoneE164: string | null;
}

const fmtNota = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function buildFacts(b: FactInput): Fact[] {
  const facts: Fact[] = [{ chave: "nome", texto: `Nome do negócio: ${b.nome}` }];
  if (b.categoria) facts.push({ chave: "categoria", texto: `Categoria no Google: ${b.categoria}` });
  if (b.cidade) facts.push({ chave: "cidade", texto: `Cidade: ${b.cidade}` });
  if (!b.site && !b.redeSocial) facts.push({ chave: "sem_site", texto: "Não há site nem rede social cadastrados no perfil do Google" });
  else if (!b.site && b.redeSocial) facts.push({ chave: "rede_social_como_site", texto: "O link cadastrado no Google é um perfil de rede social, não um site próprio" });
  else facts.push({ chave: "tem_site", texto: "Tem site próprio cadastrado no Google" });
  if (b.nota !== null && b.avaliacoes !== null && b.avaliacoes > 0) {
    facts.push({ chave: "reputacao", texto: `Nota ${fmtNota(b.nota)} no Google com ${b.avaliacoes} avaliações` });
  } else if (b.avaliacoes === 0) {
    facts.push({ chave: "sem_avaliacoes", texto: "Ainda não tem avaliações no Google" });
  }
  return facts;
}

/** Números que podem aparecer numa mensagem: os dos fatos e os que o próprio usuário escreveu. */
export function allowedNumbers(facts: Fact[], userText: string): Set<string> {
  const out = new Set<string>();
  for (const src of [...facts.map((f) => f.texto), userText]) {
    for (const n of extractNumbers(src)) out.add(n);
  }
  return out;
}

/** Extrai números normalizados ("4,7" e "4.7" viram "4.7"; "1.200" vira "1200"). */
export function extractNumbers(text: string): string[] {
  const matches = text.match(/\d+(?:[.,]\d+)*/g) ?? [];
  return matches.map((m) => {
    if (/^\d{1,3}(\.\d{3})+$/.test(m)) return m.replace(/\./g, ""); // milhar pt-BR
    return m.replace(",", ".").replace(/\.0+$/, "");
  });
}
