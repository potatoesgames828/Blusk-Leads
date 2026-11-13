import { createHash } from "node:crypto";

/** Hash estável do telefone para bloqueio global sem precisar guardar o número (só servidor). */
export function phoneHash(e164: string): string {
  return createHash("sha256").update(`blusk-phone:${e164}`).digest("hex");
}
