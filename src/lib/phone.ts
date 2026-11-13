export interface NormalizedPhone {
  e164: string; // +5511987654321
  ddd: string;
  numero: string; // sem DDD
  celular: boolean;
}

/**
 * Normaliza telefones brasileiros para E.164.
 * Aceita "(11) 98765-4321", "+55 11 98765-4321", "011987654321", "11987654321" etc.
 * Retorna null quando não dá para ter certeza do número (nunca "chuta").
 */
export function normalizeBrPhone(raw: string | null | undefined): NormalizedPhone | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  else if (digits.startsWith("0") && (digits.length === 11 || digits.length === 12)) digits = digits.slice(1);
  if (digits.length !== 10 && digits.length !== 11) return null;
  const ddd = digits.slice(0, 2);
  const numero = digits.slice(2);
  if (Number(ddd) < 10) return null;
  // Celular no Brasil: 9 dígitos começando com 9. Fixo: 8 dígitos começando com 2–5.
  const celular = numero.length === 9 && numero.startsWith("9");
  if (numero.length === 9 && !celular) return null;
  if (numero.length === 8 && !/^[2-5]/.test(numero)) return null;
  return { e164: `+55${ddd}${numero}`, ddd, numero, celular };
}

export function formatBrPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}
