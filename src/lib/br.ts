export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ",
  "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

/** Sugestões para o autocomplete de cidade (o usuário pode digitar qualquer outra). */
export const CIDADES_SUGERIDAS: { cidade: string; uf: string }[] = [
  { cidade: "São Paulo", uf: "SP" }, { cidade: "Rio de Janeiro", uf: "RJ" }, { cidade: "Belo Horizonte", uf: "MG" },
  { cidade: "Brasília", uf: "DF" }, { cidade: "Salvador", uf: "BA" }, { cidade: "Fortaleza", uf: "CE" },
  { cidade: "Curitiba", uf: "PR" }, { cidade: "Manaus", uf: "AM" }, { cidade: "Recife", uf: "PE" },
  { cidade: "Porto Alegre", uf: "RS" }, { cidade: "Belém", uf: "PA" }, { cidade: "Goiânia", uf: "GO" },
  { cidade: "Guarulhos", uf: "SP" }, { cidade: "Campinas", uf: "SP" }, { cidade: "São Luís", uf: "MA" },
  { cidade: "Maceió", uf: "AL" }, { cidade: "Natal", uf: "RN" }, { cidade: "Teresina", uf: "PI" },
  { cidade: "Campo Grande", uf: "MS" }, { cidade: "João Pessoa", uf: "PB" }, { cidade: "Florianópolis", uf: "SC" },
  { cidade: "Vitória", uf: "ES" }, { cidade: "Cuiabá", uf: "MT" }, { cidade: "Aracaju", uf: "SE" },
  { cidade: "Ribeirão Preto", uf: "SP" }, { cidade: "Uberlândia", uf: "MG" }, { cidade: "Sorocaba", uf: "SP" },
  { cidade: "Joinville", uf: "SC" }, { cidade: "Londrina", uf: "PR" }, { cidade: "Santos", uf: "SP" },
  { cidade: "Niterói", uf: "RJ" }, { cidade: "Porto Velho", uf: "RO" }, { cidade: "Macapá", uf: "AP" },
  { cidade: "Rio Branco", uf: "AC" }, { cidade: "Boa Vista", uf: "RR" }, { cidade: "Palmas", uf: "TO" },
];

export const NICHOS_SUGERIDOS = [
  "Restaurante", "Pizzaria", "Hamburgueria", "Cafeteria", "Padaria", "Academia", "Estúdio de pilates", "Clínica de estética",
  "Salão de beleza", "Barbearia", "Dentista", "Clínica médica", "Pet shop", "Imobiliária", "Loja de roupas", "Ótica",
  "Escola de idiomas", "Autoescola", "Oficina mecânica", "Concessionária", "Hotel", "Pousada", "Buffet", "Floricultura",
  "Advocacia", "Contabilidade", "Arquitetura", "Construtora",
];

export function parseCityInput(raw: string): { cidade: string | null; uf: string | null } {
  const v = raw.trim();
  if (!v) return { cidade: null, uf: null };
  const m = /^(.*?)[\s,/-]+([A-Za-z]{2})$/.exec(v);
  if (m && UFS.includes(m[2]!.toUpperCase())) return { cidade: m[1]!.trim(), uf: m[2]!.toUpperCase() };
  const known = CIDADES_SUGERIDAS.find((c) => c.cidade.toLowerCase() === v.toLowerCase());
  return { cidade: v, uf: known?.uf ?? null };
}
