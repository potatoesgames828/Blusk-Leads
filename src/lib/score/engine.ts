import { SCORE_BASE, SCORE_RULES, SCORE_RULES_VERSION, type RuleContext } from "./rules";

export interface ReceiptLine {
  chave: string;
  nome: string;
  pontos: number;
  motivo: string;
}

export interface ScoreReceipt {
  versao: number;
  base: number;
  regras: ReceiptLine[];
  ajuste_ia: { pontos: number; motivo: string } | null;
  /** Diferença aplicada para manter a nota entre 0 e 100 (0 quando não houve corte). */
  corte: number;
  total: number;
}

export type Temperature = "quente" | "morno" | "frio";

export function temperatureOf(score: number): Temperature {
  if (score >= 70) return "quente";
  if (score >= 45) return "morno";
  return "frio";
}

/**
 * Calcula a nota 0–100 e o recibo. Garantia: base + Σ pontos + ajuste_ia + corte = total.
 * `weights` sobrescreve o peso padrão de cada regra (painel "Ajustes de score").
 */
export function scoreBusiness(ctx: RuleContext, weights: Record<string, number> = {}): ScoreReceipt {
  const regras: ReceiptLine[] = [];
  for (const rule of SCORE_RULES) {
    const motivo = rule.avaliar(ctx);
    if (!motivo) continue;
    const pontos = weights[rule.chave] ?? rule.pesoPadrao;
    if (pontos === 0) continue;
    regras.push({ chave: rule.chave, nome: rule.nome, pontos, motivo });
  }
  const bruto = SCORE_BASE + regras.reduce((s, r) => s + r.pontos, 0);
  const total = Math.max(0, Math.min(100, bruto));
  return { versao: SCORE_RULES_VERSION, base: SCORE_BASE, regras, ajuste_ia: null, corte: total - bruto, total };
}

/** Confere se o recibo fecha a conta (usado em testes e ao exibir). */
export function receiptIsConsistent(r: ScoreReceipt): boolean {
  const soma = r.base + r.regras.reduce((s, l) => s + l.pontos, 0) + (r.ajuste_ia?.pontos ?? 0) + r.corte;
  return soma === r.total && r.total >= 0 && r.total <= 100;
}
