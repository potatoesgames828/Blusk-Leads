"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { moveStageAction } from "@/app/actions/leads";
import { LostReasonDialog } from "@/components/lost-reason-dialog";
import { Alert, TempBadge, cx } from "@/components/ui";
import { formatBrPhone } from "@/lib/phone";
import type { LeadCard } from "@/lib/queries";

interface Stage {
  id: string;
  nome: string;
  tipo: string;
}

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Card({ lead, stages, onMove }: { lead: LeadCard; stages: Stage[]; onMove: (leadId: string, stageId: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cx("rounded-xl border border-ink-200 bg-white p-3 shadow-sm", isDragging && "z-50 opacity-90 shadow-lg ring-2 ring-brand-500")}
      data-testid="kanban-card"
    >
      <div className="flex items-start justify-between gap-2">
        <button
          {...listeners}
          {...attributes}
          aria-label={`Arrastar ${lead.nome}`}
          className="-m-1 flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100 active:cursor-grabbing"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="currentColor">
            <circle cx="5" cy="3" r="1.5" /><circle cx="11" cy="3" r="1.5" /><circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" /><circle cx="5" cy="13" r="1.5" /><circle cx="11" cy="13" r="1.5" />
          </svg>
        </button>
        <Link href={`/leads/${lead.id}`} className="min-w-0 flex-1 font-semibold leading-tight hover:text-brand-700">
          {lead.nome}
        </Link>
        <TempBadge temp={lead.temperatura} score={lead.score} />
      </div>
      <p className="mt-1 truncate text-xs text-ink-600">{[lead.categoria, lead.telefone_e164 && formatBrPhone(lead.telefone_e164)].filter(Boolean).join(" · ")}</p>
      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink-600">
        {lead.valor_estimado_centavos ? <span>{brl(lead.valor_estimado_centavos)}</span> : null}
        {lead.proximo_followup && (
          <span className={lead.proximo_followup < today ? "font-semibold text-red-700" : undefined}>
            Follow-up {new Date(`${lead.proximo_followup}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
          </span>
        )}
        {lead.ultima_interacao_em && <span>Último contato {new Date(lead.ultima_interacao_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>}
      </div>
      {lead.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {lead.tags.map((t) => (
            <span key={t} className="rounded-full bg-ink-100 px-2 text-[11px] font-semibold text-ink-700">{t}</span>
          ))}
        </div>
      )}
      <label className="mt-2 block">
        <span className="sr-only">Mover {lead.nome} para</span>
        <select
          value={lead.stage_id ?? ""}
          onChange={(e) => onMove(lead.id, e.target.value)}
          className="block min-h-9 w-full rounded-lg border border-ink-200 bg-ink-50 px-2 text-xs font-semibold text-ink-700"
          data-testid="move-select"
        >
          {stages.map((s) => (
            <option key={s.id} value={s.id}>Mover para: {s.nome}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

function Column({ stage, children, count, total }: { stage: Stage; children: React.ReactNode; count: number; total: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <section
      ref={setNodeRef}
      aria-label={stage.nome}
      data-testid={`column-${stage.nome}`}
      className={cx("flex w-[78vw] max-w-[300px] shrink-0 snap-start flex-col rounded-2xl bg-ink-100 p-2 sm:w-[280px]", isOver && "ring-2 ring-brand-500")}
    >
      <header className="flex items-baseline justify-between px-1 pb-2">
        <h2 className="font-bold">{stage.nome}</h2>
        <span className="text-xs font-semibold text-ink-600">
          {count}
          {total > 0 && ` · ${brl(total)}`}
        </span>
      </header>
      <div className="flex min-h-24 flex-col gap-2">{children}</div>
    </section>
  );
}

export function Kanban({ stages, leads: initial }: { stages: Stage[]; leads: LeadCard[] }) {
  const [leads, setLeads] = useState(initial);
  // Dados novos do servidor (após salvar ou filtrar) substituem o estado otimista.
  useEffect(() => setLeads(initial), [initial]);
  const [lost, setLost] = useState<{ leadId: string; stageId: string } | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [, start] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const commit = (leadId: string, stageId: string, motivo?: string, texto?: string) => {
    const before = leads;
    setLeads((ls) => ls.map((l) => (l.id === leadId ? { ...l, stage_id: stageId } : l)));
    start(async () => {
      const r = await moveStageAction(leadId, stageId, motivo, texto);
      if (r.error) {
        setLeads(before);
        setMsg({ tone: "error", text: r.error });
      } else setMsg(r.ok ? { tone: "success", text: r.ok } : null);
    });
  };

  const requestMove = (leadId: string, stageId: string) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage_id === stageId) return;
    const stage = stages.find((s) => s.id === stageId);
    if (stage?.tipo === "perdido") setLost({ leadId, stageId });
    else commit(leadId, stageId);
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (e.over) requestMove(String(e.active.id), String(e.over.id));
  };

  return (
    <div>
      <div aria-live="polite" className="mb-2 min-h-0">{msg && <Alert tone={msg.tone}>{msg.text}</Alert>}</div>
      <DndContext sensors={sensors} onDragEnd={onDragEnd} accessibility={{ screenReaderInstructions: { draggable: "Para mover, pressione espaço, use as setas e pressione espaço de novo para soltar." } }}>
        <div className="relative -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4">
          {stages.map((s) => {
            const items = leads.filter((l) => l.stage_id === s.id);
            return (
              <Column key={s.id} stage={s} count={items.length} total={items.reduce((a, l) => a + (l.valor_estimado_centavos ?? 0), 0)}>
                {items.map((l) => (
                  <Card key={l.id} lead={l} stages={stages} onMove={requestMove} />
                ))}
              </Column>
            );
          })}
        </div>
      </DndContext>
      <LostReasonDialog
        open={lost !== null}
        onCancel={() => setLost(null)}
        onConfirm={(motivo, texto) => {
          const l = lost!;
          setLost(null);
          commit(l.leadId, l.stageId, motivo, texto);
        }}
      />
    </div>
  );
}
