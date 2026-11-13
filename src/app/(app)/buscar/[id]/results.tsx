"use client";

import { useState, useTransition } from "react";
import { discardAction, sendToCrmAction } from "@/app/actions/search";
import { LeadCard } from "@/components/lead-card";
import { Alert, Button, Badge } from "@/components/ui";
import type { LeadCard as LeadCardData } from "@/lib/queries";

export function SearchResults({ leads }: { leads: LeadCardData[] }) {
  const pendentes = leads.filter((l) => !l.no_crm && !l.descartado_em);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const all = pendentes.length > 0 && pendentes.every((l) => selected.has(l.id));

  const run = (fn: (ids: string[]) => Promise<{ ok?: string }>, ids: string[]) =>
    start(async () => {
      const r = await fn(ids);
      setSelected(new Set());
      setMsg(r.ok ?? null);
    });

  return (
    <div className="space-y-3">
      {msg && <Alert tone="success">{msg}</Alert>}
      {pendentes.length > 0 && (
        <div className="sticky top-[61px] z-20 -mx-4 flex flex-wrap items-center gap-2 border-y border-ink-200 bg-ink-50/95 px-4 py-2 backdrop-blur">
          <label className="mr-auto flex min-h-11 items-center gap-2 text-[15px] font-semibold">
            <input type="checkbox" className="size-5 accent-brand-600" checked={all} onChange={() => setSelected(all ? new Set() : new Set(pendentes.map((l) => l.id)))} />
            Selecionar todos ({selected.size})
          </label>
          <Button disabled={!selected.size || pending} onClick={() => run(sendToCrmAction, [...selected])}>
            Enviar para o CRM
          </Button>
          <Button variant="secondary" disabled={!selected.size || pending} onClick={() => run(discardAction, [...selected])}>
            Descartar
          </Button>
        </div>
      )}
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {leads.map((l) => {
          const done = l.no_crm || l.descartado_em;
          return (
            <li key={l.id} className={done ? "opacity-70" : undefined}>
              <LeadCard lead={l}>
                <div className="mt-3 flex items-center justify-between gap-2">
                  {done ? (
                    <Badge>{l.no_crm ? "No CRM" : "Descartado"}</Badge>
                  ) : (
                    <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-ink-700">
                      <input type="checkbox" className="size-5 accent-brand-600" checked={selected.has(l.id)} onChange={() => toggle(l.id)} aria-label={`Selecionar ${l.nome}`} />
                      Selecionar
                    </label>
                  )}
                  <a href={`/leads/${l.id}`} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                    Ver e gerar mensagem →
                  </a>
                </div>
              </LeadCard>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
