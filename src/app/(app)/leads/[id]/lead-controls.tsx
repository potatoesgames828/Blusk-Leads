"use client";

import { useState, useTransition } from "react";
import { addFollowupAction, addNoteAction, completeFollowupAction, moveStageAction, updateLeadInfoAction } from "@/app/actions/leads";
import { LostReasonDialog } from "@/components/lost-reason-dialog";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";

interface Stage {
  id: string;
  nome: string;
  tipo: string;
}

function useFeedback() {
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const show = (r: { ok?: string; error?: string }) => setMsg(r.error ? { tone: "error", text: r.error } : r.ok ? { tone: "success", text: r.ok } : null);
  const node = msg && <Alert tone={msg.tone}>{msg.text}</Alert>;
  return { show, node };
}

export function StageControl({ leadId, stages, current }: { leadId: string; stages: Stage[]; current: string | null }) {
  const [value, setValue] = useState(current ?? "");
  const [lostFor, setLostFor] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fb = useFeedback();

  const move = (stageId: string, motivo?: string, texto?: string) =>
    start(async () => {
      const r = await moveStageAction(leadId, stageId, motivo, texto);
      fb.show(r);
      if (!r.error) setValue(stageId);
    });

  return (
    <div className="space-y-2">
      <Field label="Etapa no CRM" htmlFor="etapa">
        <Select
          id="etapa"
          value={value}
          disabled={pending}
          onChange={(e) => {
            const s = stages.find((x) => x.id === e.target.value);
            if (!s) return;
            if (s.tipo === "perdido") setLostFor(s.id);
            else move(s.id);
          }}
        >
          {!current && <option value="">Fora do CRM (ainda na lista de busca)</option>}
          {stages.map((s) => (
            <option key={s.id} value={s.id}>{s.nome}</option>
          ))}
        </Select>
      </Field>
      {fb.node}
      <LostReasonDialog
        open={lostFor !== null}
        onCancel={() => setLostFor(null)}
        onConfirm={(motivo, texto) => {
          const id = lostFor!;
          setLostFor(null);
          move(id, motivo, texto);
        }}
      />
    </div>
  );
}

export function FollowupControl({ leadId, followups }: { leadId: string; followups: { id: string; vence_em: string; origem: string }[] }) {
  const [date, setDate] = useState("");
  const [pending, start] = useTransition();
  const fb = useFeedback();
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-3">
      {followups.length === 0 ? (
        <p className="text-[15px] text-ink-600">Nenhum lembrete pendente.</p>
      ) : (
        <ul className="space-y-2">
          {followups.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 rounded-xl bg-ink-50 px-3 py-2">
              <span className={f.vence_em < today ? "font-semibold text-red-700" : f.vence_em === today ? "font-semibold text-brand-700" : ""}>
                {new Date(`${f.vence_em}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
                {f.vence_em < today && " · vencido"}
                {f.origem === "cadencia" && <span className="ml-1 text-xs font-normal text-ink-500">(cadência)</span>}
              </span>
              <Button variant="ghost" disabled={pending} onClick={() => start(() => completeFollowupAction(f.id))}>
                Concluir
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            fb.show(await addFollowupAction(leadId, date));
            setDate("");
          });
        }}
      >
        <Input type="date" aria-label="Data do lembrete" value={date} min={today} onChange={(e) => setDate(e.target.value)} required className="flex-1" />
        <Button type="submit" variant="secondary" disabled={pending || !date}>Agendar</Button>
      </form>
      {fb.node}
    </div>
  );
}

export function NoteForm({ leadId }: { leadId: string }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const fb = useFeedback();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addNoteAction(leadId, text);
          fb.show(r);
          if (!r.error) setText("");
        });
      }}
    >
      <Textarea aria-label="Nova nota" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Ex.: falei com a dona, pediu para retornar na segunda." />
      <Button type="submit" variant="secondary" disabled={pending || !text.trim()}>Salvar nota</Button>
      {fb.node}
    </form>
  );
}

export function InfoForm({ leadId, valor, tags }: { leadId: string; valor: number | null; tags: string[] }) {
  const [v, setV] = useState(valor !== null ? (valor / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "");
  const [t, setT] = useState(tags.join(", "));
  const [pending, start] = useTransition();
  const fb = useFeedback();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => fb.show(await updateLeadInfoAction(leadId, v, t)));
      }}
    >
      <Field label="Valor estimado (R$)" htmlFor="valor" hint="Quanto você espera cobrar. Só você vê.">
        <Input id="valor" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} placeholder="Ex.: 1.500,00" />
      </Field>
      <Field label="Etiquetas" htmlFor="tags" hint="Separe por vírgula.">
        <Input id="tags" value={t} onChange={(e) => setT(e.target.value)} placeholder="Ex.: indicação, urgente" />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>Salvar</Button>
      {fb.node}
    </form>
  );
}
