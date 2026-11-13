"use client";

import { useEffect, useRef, useState } from "react";
import { LOST_REASONS } from "@/lib/crm";
import { Button, Field, Select, Textarea } from "./ui";

/** Motivo obrigatório ao marcar um lead como "Perdido". */
export function LostReasonDialog({ open, onCancel, onConfirm }: { open: boolean; onCancel: () => void; onConfirm: (motivo: string, texto: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [motivo, setMotivo] = useState("");
  const [texto, setTexto] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const invalid = !motivo || (motivo === "outro" && !texto.trim());

  return (
    <dialog ref={ref} onCancel={onCancel} className="fixed inset-0 m-auto h-fit max-h-[90dvh] w-[min(92vw,420px)] overflow-y-auto rounded-2xl bg-white p-0 backdrop:bg-black/40" aria-labelledby="lost-title">
      <form
        method="dialog"
        className="space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!invalid) onConfirm(motivo, texto);
        }}
      >
        <h2 id="lost-title" className="text-lg font-bold">Por que este lead foi perdido?</h2>
        <Field label="Motivo" htmlFor="motivo-perda">
          <Select id="motivo-perda" value={motivo} onChange={(e) => setMotivo(e.target.value)} required>
            <option value="">Escolha…</option>
            {LOST_REASONS.map((r) => (
              <option key={r.id} value={r.id}>{r.nome}</option>
            ))}
          </Select>
        </Field>
        <Field label={motivo === "outro" ? "Descreva (obrigatório)" : "Detalhes (opcional)"} htmlFor="motivo-texto">
          <Textarea id="motivo-texto" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={500} />
        </Field>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" className="flex-1" disabled={invalid}>Confirmar</Button>
        </div>
      </form>
    </dialog>
  );
}
