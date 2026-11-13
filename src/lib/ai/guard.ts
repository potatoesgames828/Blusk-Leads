import { allowedNumbers, extractNumbers, type Fact } from "./facts";

export const OPT_OUT_LINE = "Se preferir não receber mensagens minhas, é só responder SAIR que não entro mais em contato.";

const FORBIDDEN: { re: RegExp; motivo: string }[] = [
  { re: /garant/i, motivo: "promete garantia de resultado" },
  { re: /100\s?%/, motivo: "promete resultado absoluto" },
  { re: /\bvai (dobrar|triplicar|multiplicar)/i, motivo: "promete resultado" },
  { re: /\bvocês? (vai|vão) vender mais\b/i, motivo: "promete resultado" },
];

export interface GuardResult {
  ok: boolean;
  problemas: string[];
}

/**
 * Confere uma mensagem gerada: só pode citar números presentes nos fatos do lead
 * ou no texto do próprio usuário, sem preço/prazo inventado e sem promessa de resultado.
 */
export function checkMessage(text: string, facts: Fact[], userText: string): GuardResult {
  const problemas: string[] = [];
  const allowed = allowedNumbers(facts, userText);
  for (const n of extractNumbers(text.replace(OPT_OUT_LINE, ""))) {
    if (!allowed.has(n)) problemas.push(`cita o número "${n}", que não está nos dados do lead`);
  }
  if (/R\$/.test(text) && !/R\$/.test(userText)) problemas.push("cita preço que você não informou");
  for (const f of FORBIDDEN) if (f.re.test(text)) problemas.push(f.motivo);
  return { ok: problemas.length === 0, problemas };
}

export function ensureOptOut(text: string): string {
  if (/\bSAIR\b/.test(text)) return text.trim();
  return `${text.trim()}\n\n${OPT_OUT_LINE}`;
}
