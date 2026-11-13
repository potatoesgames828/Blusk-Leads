/** Normaliza texto para comparação: minúsculo, sem acento, sem espaços extras. */
export function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Sinônimos por nicho, usados para reconhecer categorias excluídas.
 * Ex.: excluir "advocacia" também exclui "advogado", "escritório de advocacia" e o tipo "lawyer" do Google.
 * Lista editável: adicionar um sinônimo aqui não muda nenhuma regra de cobrança.
 */
export const NICHE_SYNONYMS: Record<string, string[]> = {
  advocacia: ["advocacia", "advogado", "advogada", "advogados", "escritorio de advocacia", "juridico", "lawyer", "law firm", "attorney"],
  contabilidade: ["contabilidade", "contador", "contadora", "contabil", "accounting", "accountant"],
  odontologia: ["odontologia", "dentista", "odontologica", "odontologico", "dentist", "dental"],
  estetica: ["estetica", "clinica de estetica", "beauty salon", "spa", "esteticista"],
  restaurante: ["restaurante", "restaurant", "lanchonete", "pizzaria", "hamburgueria", "meal_takeaway", "food"],
  imobiliaria: ["imobiliaria", "corretor de imoveis", "real estate", "real_estate_agency"],
  academia: ["academia", "gym", "crossfit", "pilates", "fitness"],
  petshop: ["pet shop", "petshop", "veterinario", "veterinaria", "pet_store", "veterinary_care"],
  salao: ["salao de beleza", "cabeleireiro", "barbearia", "barber", "hair_care", "hair salon"],
  igreja: ["igreja", "church", "templo", "place_of_worship"],
};

/** Verdadeiro se algum texto do negócio (categoria, tipos) bate com um nicho excluído. */
export function matchesExcludedNiche(businessTexts: (string | null | undefined)[], excluded: string[]): string | null {
  const hay = businessTexts.filter(Boolean).map((t) => norm(String(t).replace(/_/g, " ")));
  for (const niche of excluded) {
    const key = norm(niche);
    const terms = new Set([key, ...(NICHE_SYNONYMS[key] ?? []).map(norm)]);
    for (const h of hay) {
      for (const term of terms) {
        const t = term.replace(/_/g, " ");
        if (h === t || h.includes(t)) return niche;
      }
    }
  }
  return null;
}

/** Categorias "visuais", em que vídeo e motion costumam gerar mais retorno. Configurável. */
export const VISUAL_CATEGORIES = [
  "restaurante", "estetica", "imobiliaria", "academia", "salao", "petshop", "odontologia",
  "loja", "store", "cafe", "bakery", "padaria", "hotel", "pousada", "turismo", "moda", "boutique",
  "clinica", "clinic", "escola", "school", "evento", "buffet", "auto", "concessionaria", "car_dealer",
];

export function isVisualCategory(texts: (string | null | undefined)[]): boolean {
  const hay = texts.filter(Boolean).map((t) => norm(String(t).replace(/_/g, " ")));
  return VISUAL_CATEGORIES.some((c) => {
    const key = norm(c.replace(/_/g, " "));
    const syn = (NICHE_SYNONYMS[key] ?? []).map(norm);
    return hay.some((h) => h.includes(key) || syn.some((s) => h.includes(s.replace(/_/g, " "))));
  });
}
