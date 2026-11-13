import type { Fact } from "./facts";
import { ensureOptOut } from "./guard";

export type Style = "formal" | "amigavel" | "direto";

export interface MessagePack {
  whatsapp: { curta: string; media: string; pergunta: string };
  email: { assunto: string; corpo: string };
  ligacao: string[];
}

export interface GenerateInput {
  facts: Fact[];
  nomeNegocio: string;
  estilo: Style;
  ofertas: string[];
  sobreMim: string;
  nomeUsuario: string;
  idioma?: "pt" | "en";
}

const OFFER_TEXT: Record<string, string> = {
  motion: "motion graphics e vídeos animados",
  site: "criação de sites",
  landing_page: "landing pages",
  social_media: "social media",
  trafego_pago: "tráfego pago",
  design: "design",
};

export function offerText(ofertas: string[]): string {
  const parts = ofertas.map((o) => OFFER_TEXT[o]).filter(Boolean) as string[];
  if (parts.length === 0) return "serviços criativos e digitais";
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(", ")} e ${parts.at(-1)}`;
}

/** Observação principal, sempre baseada num fato real. Sem fato útil: abordagem genérica e honesta. */
function hook(facts: Fact[], ofertas: string[]): { frase: string; chave: string | null } {
  const has = (k: string) => facts.find((f) => f.chave === k);
  const rep = has("reputacao");
  const sellsSite = ofertas.includes("site") || ofertas.includes("landing_page");
  if (has("sem_site") && sellsSite) return { frase: "vi que vocês ainda não têm um site cadastrado no Google", chave: "sem_site" };
  if (has("rede_social_como_site") && sellsSite)
    return { frase: "vi que o link de vocês no Google leva para uma rede social, e não para um site próprio", chave: "rede_social_como_site" };
  if (rep) {
    const m = /Nota ([\d,]+) no Google com (\d+) avaliações/.exec(rep.texto);
    if (m) return { frase: `vi que a nota de vocês no Google está em ${m[1]}, com ${m[2]} avaliações`, chave: "reputacao" };
  }
  if (has("sem_site")) return { frase: "vi que o perfil de vocês no Google ainda não tem site nem rede social", chave: "sem_site" };
  if (has("sem_avaliacoes")) return { frase: "vi que o perfil de vocês no Google ainda não tem avaliações", chave: "sem_avaliacoes" };
  return { frase: "encontrei o perfil de vocês no Google", chave: null };
}

function greeting(estilo: Style, nome: string): string {
  if (estilo === "formal") return `Bom dia, equipe ${nome}.`;
  if (estilo === "direto") return `Oi, pessoal da ${nome}.`;
  return `Oi, pessoal da ${nome}! Tudo bem?`;
}

/** Gerador determinístico usado quando não há IA configurada ou a IA falha na verificação. */
export function templateMessages(input: GenerateInput): MessagePack {
  const { frase } = hook(input.facts, input.ofertas);
  const oferta = offerText(input.ofertas);
  const eu = input.nomeUsuario.split(" ")[0] ?? input.nomeUsuario;
  const sobre = input.sobreMim.trim() ? ` ${input.sobreMim.trim().replace(/\.?$/, ".")}` : "";
  const oi = greeting(input.estilo, input.nomeNegocio);
  const frasePrimeira = frase.charAt(0).toUpperCase() + frase.slice(1);

  const curta = ensureOptOut(`${oi} Sou ${eu} e trabalho com ${oferta}. ${frasePrimeira}. Posso te mostrar uma ideia rápida para vocês?`);
  const media = ensureOptOut(
    `${oi} Meu nome é ${eu} e trabalho com ${oferta}.${sobre}\n\n${frasePrimeira} e pensei em algumas ideias que podem ajudar a apresentar melhor o negócio de vocês. Se fizer sentido, te mando alguns exemplos de trabalhos parecidos, sem compromisso.`,
  );
  const pergunta = ensureOptOut(
    `${oi} Sou ${eu}, trabalho com ${oferta}. ${frasePrimeira}. Vocês já pensaram em usar ${input.ofertas.includes("motion") ? "vídeo" : "isso"} para atrair mais clientes? Posso te contar como costumo ajudar negócios como o de vocês?`,
  );

  const corpo = ensureOptOut(
    `${input.estilo === "formal" ? `Prezados, equipe ${input.nomeNegocio},` : `Olá, equipe ${input.nomeNegocio}!`}\n\nMeu nome é ${eu} e trabalho com ${oferta}.${sobre}\n\n${frasePrimeira} e acredito que posso ajudar vocês a apresentar melhor o que fazem.\n\nSe fizer sentido, respondo este e-mail com alguns exemplos de trabalhos e uma ideia inicial para vocês, sem compromisso.\n\nAbraço,\n${input.nomeUsuario}`,
  );

  return {
    whatsapp: { curta, media, pergunta },
    email: { assunto: `Uma ideia para a ${input.nomeNegocio}`, corpo },
    ligacao: [
      `Apresente-se: ${eu}, trabalha com ${oferta}.`,
      `Cite o que você viu: ${frase}.`,
      "Pergunte como eles atraem clientes hoje e se já usaram esse tipo de serviço.",
      "Ofereça mandar exemplos de trabalhos pelo WhatsApp ou e-mail, sem compromisso.",
      "Se não houver interesse, agradeça e pergunte se pode tirar o contato da sua lista.",
    ],
  };
}
