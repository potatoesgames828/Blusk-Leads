"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createSearchAction } from "@/app/actions/search";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field, Input, Select } from "@/components/ui";
import { initialState } from "@/lib/action-state";
import { CIDADES_SUGERIDAS, NICHOS_SUGERIDOS } from "@/lib/br";
import { OFFER_FILTER_LIST, type OfferFilter } from "@/lib/filters";

export function SearchForm({
  plano,
  saldo,
  defaultFiltro,
  defaultCidade,
  defaultNicho,
}: {
  plano: string;
  saldo: number;
  defaultFiltro: OfferFilter;
  defaultCidade: string;
  defaultNicho: string;
}) {
  const [state, action] = useActionState(createSearchAction, initialState);
  const [filtro, setFiltro] = useState<OfferFilter>(defaultFiltro);
  const max = Math.max(1, Math.min(60, saldo));
  const [pedidos, setPedidos] = useState(Math.min(plano === "teste" ? 5 : 20, max));
  const def = OFFER_FILTER_LIST.find((f) => f.id === filtro)!;
  const semSaldo = saldo < 1;

  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Nicho" htmlFor="nicho" hint="O tipo de negócio que você quer atender.">
        <Input id="nicho" name="nicho" list="nichos" required minLength={2} maxLength={80} defaultValue={defaultNicho} placeholder="Ex.: restaurante" />
      </Field>
      <datalist id="nichos">
        {NICHOS_SUGERIDOS.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      {plano === "teste" ? (
        <div className="rounded-xl bg-ink-100 px-3 py-2.5 text-[15px] text-ink-700">
          <strong>Região: Brasil todo.</strong> No teste grátis não dá para escolher a cidade. Esse recurso faz parte dos planos pagos.
        </div>
      ) : (
        <Field label="Cidade" htmlFor="cidade" hint="Deixe vazio para buscar no Brasil todo. Ex.: Curitiba - PR">
          <Input id="cidade" name="cidade" list="cidades-busca" defaultValue={defaultCidade} maxLength={80} />
        </Field>
      )}
      <datalist id="cidades-busca">
        {CIDADES_SUGERIDAS.map((c) => (
          <option key={c.cidade} value={`${c.cidade} - ${c.uf}`} />
        ))}
      </datalist>

      <Field label="Filtro por oferta" htmlFor="filtro">
        <Select id="filtro" name="filtro" value={filtro} onChange={(e) => setFiltro(e.target.value as OfferFilter)}>
          {OFFER_FILTER_LIST.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </Select>
      </Field>
      <p className="-mt-2 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900">
        <strong>Bom para {def.boaPara.toLowerCase()}.</strong> {def.regra}
      </p>

      <Field label={`Quantidade de leads: ${pedidos}`} htmlFor="pedidos" hint={`Custa até ${pedidos} crédito${pedidos === 1 ? "" : "s"}. Você tem ${saldo}. Só os leads novos entregues são cobrados.`}>
        <input
          id="pedidos"
          name="pedidos"
          type="range"
          min={1}
          max={max}
          value={pedidos}
          onChange={(e) => setPedidos(Number(e.target.value))}
          className="h-11 w-full accent-brand-600"
          disabled={semSaldo}
        />
      </Field>

      {semSaldo ? (
        <Alert tone="warning">
          Seus créditos acabaram. <Link href="/saldo" className="font-semibold underline">Ver opções</Link>
        </Alert>
      ) : (
        <SubmitButton className="w-full" pendingText="Iniciando busca…">
          Buscar leads
        </SubmitButton>
      )}
    </form>
  );
}
