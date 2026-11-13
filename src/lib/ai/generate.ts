import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { checkMessage, ensureOptOut } from "./guard";
import { offerText, templateMessages, type GenerateInput, type MessagePack } from "./templates";

const PackSchema = z.object({
  whatsapp: z.object({ curta: z.string(), media: z.string(), pergunta: z.string() }),
  email: z.object({ assunto: z.string(), corpo: z.string() }),
  ligacao: z.array(z.string()),
});

export interface GenerateResult {
  pack: MessagePack;
  gerador: "ia" | "modelo";
  /** Variações da IA trocadas pelo modelo seguro, com o motivo. */
  substituicoes: string[];
}

const STYLE_TEXT = {
  formal: "formal e respeitoso",
  amigavel: "amigável e próximo, sem exageros",
  direto: "direto e objetivo, frases curtas",
};

function systemPrompt(): string {
  return [
    "Você escreve primeiras mensagens de prospecção para um freelancer brasileiro que vende serviços criativos e digitais.",
    "Regras obrigatórias:",
    "- Use SOMENTE os fatos fornecidos sobre o negócio. Não afirme nada que não esteja nos fatos (nada de suposições sobre faturamento, concorrentes, problemas ou intenções).",
    "- Cite pelo menos um fato concreto e verificável quando houver (ex.: ausência de site, nota e número de avaliações). Se não houver fato útil, seja genérico e honesto.",
    "- Não invente preço, prazo, desconto, números ou resultados. Não prometa resultados.",
    "- Não use números que não estejam nos fatos ou no texto 'sobre mim'.",
    "- Escreva em português do Brasil, sem jargão de marketing.",
    "- WhatsApp: 'curta' (até 2 frases), 'media' (até 5 frases), 'pergunta' (termina com uma pergunta aberta).",
    "- E-mail: assunto curto e corpo de até 120 palavras, assinado com o nome do usuário.",
    "- Ligação: 3 a 5 tópicos curtos de roteiro.",
    "- Não inclua link nem a frase de descadastro: o sistema adiciona a opção de sair automaticamente.",
  ].join("\n");
}

function userPrompt(input: GenerateInput): string {
  return [
    `Nome do usuário (quem envia): ${input.nomeUsuario}`,
    `O que o usuário vende: ${offerText(input.ofertas)}`,
    `Sobre o usuário (escrito por ele): ${input.sobreMim.trim() || "(não informado)"}`,
    `Tom: ${STYLE_TEXT[input.estilo]}`,
    "",
    "Fatos verificáveis sobre o negócio:",
    ...input.facts.map((f) => `- ${f.texto}`),
  ].join("\n");
}

async function callClaude(input: GenerateInput): Promise<MessagePack | null> {
  const client = new Anthropic({ timeout: 45_000, maxRetries: 1 });
  try {
    const response = await client.messages.parse({
      model: process.env.AI_MODEL || "claude-opus-5-5",
      max_tokens: 4000,
      system: systemPrompt(),
      messages: [{ role: "user", content: userPrompt(input) }],
      output_config: { effort: "low", format: zodOutputFormat(PackSchema) },
    });
    if (response.stop_reason === "refusal") return null;
    return response.parsed_output ?? null;
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error(JSON.stringify({ evento: "ia_erro", status: err.status, tipo: err.name }));
      return null;
    }
    throw err;
  }
}

/**
 * Gera 3 variações de WhatsApp, e-mail e roteiro de ligação.
 * Com ANTHROPIC_API_KEY: usa a IA e confere cada variação contra os fatos; o que não passar
 * é trocado pela versão do modelo determinístico (que só usa fatos). Sem chave: só o modelo.
 */
export async function generateMessages(input: GenerateInput, opts: { useAi?: boolean } = {}): Promise<GenerateResult> {
  const fallback = templateMessages(input);
  const useAi = opts.useAi ?? Boolean(process.env.ANTHROPIC_API_KEY);
  if (!useAi) return { pack: fallback, gerador: "modelo", substituicoes: [] };

  const ai = await callClaude(input);
  if (!ai) return { pack: fallback, gerador: "modelo", substituicoes: ["A IA não respondeu; usamos o modelo seguro."] };
  return { ...sanitizePack(ai, fallback, input), gerador: "ia" };
}

/** Aplica o verificador em cada texto da IA. Exportado para testes. */
export function sanitizePack(ai: MessagePack, fallback: MessagePack, input: GenerateInput): { pack: MessagePack; substituicoes: string[] } {
  const substituicoes: string[] = [];
  const pick = (label: string, aiText: string, safe: string) => {
    const r = checkMessage(aiText, input.facts, input.sobreMim);
    if (r.ok) return ensureOptOut(aiText);
    substituicoes.push(`${label}: ${r.problemas.join("; ")}`);
    return safe;
  };
  const ligacaoOk = ai.ligacao.length >= 3 && ai.ligacao.length <= 5 && ai.ligacao.every((t) => checkMessage(t, input.facts, input.sobreMim).ok);
  if (!ligacaoOk) substituicoes.push("Roteiro de ligação: fora das regras");
  const assuntoOk = checkMessage(ai.email.assunto, input.facts, input.sobreMim).ok;
  return {
    pack: {
      whatsapp: {
        curta: pick("WhatsApp curta", ai.whatsapp.curta, fallback.whatsapp.curta),
        media: pick("WhatsApp média", ai.whatsapp.media, fallback.whatsapp.media),
        pergunta: pick("WhatsApp com pergunta", ai.whatsapp.pergunta, fallback.whatsapp.pergunta),
      },
      email: {
        assunto: assuntoOk ? ai.email.assunto : fallback.email.assunto,
        corpo: pick("E-mail", ai.email.corpo, fallback.email.corpo),
      },
      ligacao: ligacaoOk ? ai.ligacao : fallback.ligacao,
    },
    substituicoes,
  };
}
