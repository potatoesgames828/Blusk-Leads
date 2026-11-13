import type { BusinessData } from "../business";
import { FILTER_LIMITS } from "../filters";
import { isVisualCategory } from "../niches";

export interface RuleContext {
  business: BusinessData;
  ofertas: string[];
}

export interface ScoreRule {
  chave: string;
  nome: string;
  descricao: string;
  pesoPadrao: number;
  /** Retorna o motivo (texto do recibo) se a regra se aplica, ou null. */
  avaliar: (ctx: RuleContext) => string | null;
}

const fmtNota = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const vendeSite = (o: string[]) => o.includes("site") || o.includes("landing_page");
const vendeVideo = (o: string[]) => o.includes("motion");

/**
 * Regras transparentes e configuráveis. Cada uma soma ou tira pontos e explica o porquê.
 * Mudou uma regra? Incremente SCORE_RULES_VERSION para o recibo indicar a versão usada.
 */
export const SCORE_RULES_VERSION = 1;
export const SCORE_BASE = 30;

export const SCORE_RULES: ScoreRule[] = [
  {
    chave: "sem_site",
    nome: "Sem site próprio",
    descricao: "Não há domínio próprio cadastrado no Google.",
    pesoPadrao: 15,
    avaliar: ({ business }) => (!business.site ? "Não há site próprio cadastrado no Google" : null),
  },
  {
    chave: "sem_site_oferta_site",
    nome: "Sem site (você vende site)",
    descricao: "Bônus extra quando você vende site ou landing page e o negócio não tem site.",
    pesoPadrao: 10,
    avaliar: ({ business, ofertas }) =>
      !business.site && vendeSite(ofertas) ? "Você vende site e o negócio não tem um" : null,
  },
  {
    chave: "rede_social_como_site",
    nome: "Usa rede social como site",
    descricao: "O link cadastrado no Google é um perfil de rede social ou WhatsApp.",
    pesoPadrao: 5,
    avaliar: ({ business }) => (business.redeSocial ? "Usa uma rede social no lugar do site" : null),
  },
  {
    chave: "poucas_avaliacoes",
    nome: "Poucas avaliações",
    descricao: `Menos de ${FILTER_LIMITS.poucasAvaliacoes} avaliações no Google.`,
    pesoPadrao: 10,
    avaliar: ({ business }) =>
      business.avaliacoes !== null && business.avaliacoes < FILTER_LIMITS.poucasAvaliacoes
        ? `${business.avaliacoes} avaliações no Google (limite: ${FILTER_LIMITS.poucasAvaliacoes})`
        : null,
  },
  {
    chave: "nota_baixa",
    nome: "Nota baixa",
    descricao: `Nota média abaixo de ${fmtNota(FILTER_LIMITS.notaBaixa)} no Google.`,
    pesoPadrao: 5,
    avaliar: ({ business }) =>
      business.nota !== null && business.nota < FILTER_LIMITS.notaBaixa
        ? `Nota ${fmtNota(business.nota)} no Google (abaixo de ${fmtNota(FILTER_LIMITS.notaBaixa)})`
        : null,
  },
  {
    chave: "boa_reputacao_video",
    nome: "Boa reputação para vídeo",
    descricao: "Você vende vídeo e o negócio tem boa nota e clientes: tem o que mostrar e costuma poder investir.",
    pesoPadrao: 15,
    avaliar: ({ business, ofertas }) =>
      vendeVideo(ofertas) &&
      (business.nota ?? 0) >= FILTER_LIMITS.videoNotaMin &&
      (business.avaliacoes ?? 0) >= FILTER_LIMITS.videoAvaliacoesMin
        ? `Nota ${fmtNota(business.nota ?? 0)} com ${business.avaliacoes} avaliações`
        : null,
  },
  {
    chave: "categoria_visual",
    nome: "Categoria visual",
    descricao: "Você vende vídeo e a categoria do negócio costuma usar muito conteúdo visual.",
    pesoPadrao: 10,
    avaliar: ({ business, ofertas }) =>
      vendeVideo(ofertas) && isVisualCategory([business.categoria, ...business.tipos])
        ? `Categoria "${business.categoria ?? business.tipos[0] ?? "visual"}" usa muito conteúdo visual`
        : null,
  },
  {
    chave: "telefone_presente",
    nome: "Tem telefone",
    descricao: "Há telefone comercial público para contato.",
    pesoPadrao: 10,
    avaliar: ({ business }) => (business.telefoneE164 ? "Telefone comercial disponível" : null),
  },
  {
    chave: "whatsapp_provavel",
    nome: "WhatsApp provável",
    descricao: "O telefone é de celular, então provavelmente tem WhatsApp.",
    pesoPadrao: 10,
    avaliar: ({ business }) => (business.whatsappProvavel ? "Número de celular: WhatsApp provável" : null),
  },
  {
    chave: "sem_telefone",
    nome: "Sem telefone",
    descricao: "Não há telefone público: abordagem bem mais difícil.",
    pesoPadrao: -30,
    avaliar: ({ business }) => (!business.telefoneE164 ? "Sem telefone público no Google" : null),
  },
  {
    chave: "fechado_temporariamente",
    nome: "Fechado temporariamente",
    descricao: "O Google indica que o negócio está fechado temporariamente.",
    pesoPadrao: -40,
    avaliar: ({ business }) =>
      business.statusFuncionamento === "CLOSED_TEMPORARILY" ? "Marcado como fechado temporariamente no Google" : null,
  },
];

export const RULES_BY_KEY = Object.fromEntries(SCORE_RULES.map((r) => [r.chave, r]));
