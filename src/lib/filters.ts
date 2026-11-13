import type { BusinessData } from "./business";
import { isVisualCategory } from "./niches";

export type OfferFilter = "sem_site" | "sem_presenca" | "pouco_movimento" | "potencial_video" | "qualquer";

export interface FilterDef {
  id: OfferFilter;
  nome: string;
  boaPara: string;
  regra: string; // descrição transparente, mostrada ao usuário
  aplica: (b: BusinessData) => boolean;
}

/** Limiares configuráveis num só lugar. */
export const FILTER_LIMITS = {
  poucasAvaliacoes: 20,
  notaBaixa: 4.0,
  videoNotaMin: 4.0,
  videoAvaliacoesMin: 20,
};

const operando = (b: BusinessData) => b.statusFuncionamento !== "CLOSED_PERMANENTLY" && b.statusFuncionamento !== "CLOSED_TEMPORARILY";

export const OFFER_FILTERS: Record<OfferFilter, FilterDef> = {
  sem_site: {
    id: "sem_site",
    nome: "Sem site",
    boaPara: "Site e landing page",
    regra: "Negócios ativos sem domínio próprio no Google, incluindo os que usam Instagram, Facebook ou WhatsApp no lugar do site.",
    aplica: (b) => operando(b) && !b.site,
  },
  sem_presenca: {
    id: "sem_presenca",
    nome: "Sem presença digital",
    boaPara: "Social media",
    regra: `Sem site, sem rede social divulgada no Google e com menos de ${FILTER_LIMITS.poucasAvaliacoes} avaliações.`,
    aplica: (b) => operando(b) && !b.site && !b.redeSocial && (b.avaliacoes ?? 0) < FILTER_LIMITS.poucasAvaliacoes,
  },
  pouco_movimento: {
    id: "pouco_movimento",
    nome: "Pouco movimento",
    boaPara: "Tráfego pago e vídeo de divulgação",
    regra: `Nota abaixo de ${FILTER_LIMITS.notaBaixa.toLocaleString("pt-BR")} ou menos de ${FILTER_LIMITS.poucasAvaliacoes} avaliações no Google.`,
    aplica: (b) =>
      operando(b) &&
      ((b.nota !== null && b.nota < FILTER_LIMITS.notaBaixa) || (b.avaliacoes ?? 0) < FILTER_LIMITS.poucasAvaliacoes),
  },
  potencial_video: {
    id: "potencial_video",
    nome: "Potencial para vídeo e motion",
    boaPara: "Motion graphics e vídeo",
    regra: `Negócios de categoria visual (restaurante, estética, imobiliária, academia etc.), com nota a partir de ${FILTER_LIMITS.videoNotaMin.toLocaleString("pt-BR")} e pelo menos ${FILTER_LIMITS.videoAvaliacoesMin} avaliações: já têm clientes e um bom serviço para mostrar. Não verificamos se o negócio já tem vídeo (o Google não informa isso).`,
    aplica: (b) =>
      operando(b) &&
      isVisualCategory([b.categoria, ...b.tipos]) &&
      (b.nota ?? 0) >= FILTER_LIMITS.videoNotaMin &&
      (b.avaliacoes ?? 0) >= FILTER_LIMITS.videoAvaliacoesMin,
  },
  qualquer: {
    id: "qualquer",
    nome: "Qualquer negócio ativo",
    boaPara: "Serviços B2B em geral",
    regra: "Qualquer negócio que não esteja fechado no Google.",
    aplica: (b) => operando(b),
  },
};

export const OFFER_FILTER_LIST = Object.values(OFFER_FILTERS);

/** Filtro sugerido de acordo com o que o usuário vende. */
export function defaultFilterForOffers(ofertas: string[]): OfferFilter {
  if (ofertas.includes("motion")) return "potencial_video";
  if (ofertas.includes("site") || ofertas.includes("landing_page")) return "sem_site";
  if (ofertas.includes("social_media")) return "sem_presenca";
  if (ofertas.includes("trafego_pago")) return "pouco_movimento";
  return "qualquer";
}

export const OFFERS = [
  { id: "motion", nome: "Motion graphics e vídeo" },
  { id: "site", nome: "Site" },
  { id: "landing_page", nome: "Landing page" },
  { id: "social_media", nome: "Social media" },
  { id: "trafego_pago", nome: "Tráfego pago" },
  { id: "design", nome: "Design" },
  { id: "outro", nome: "Outro" },
] as const;
