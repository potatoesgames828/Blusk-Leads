/**
 * Monta o link oficial de clique do WhatsApp (envio manual pelo próprio usuário).
 * Formato: https://wa.me/55DDDNUMERO?text=MENSAGEM_CODIFICADA
 * Não existe disparo automático no Blusk Leads.
 */
export function whatsappLink(e164: string, message: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.length < 10) throw new Error("Telefone inválido para WhatsApp");
  const text = message.trim();
  return text ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/${digits}`;
}
