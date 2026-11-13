"use client";

import { useActionState } from "react";
import { adjustCreditsAction, setPlanAction } from "@/app/actions/admin";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field, Input, Select } from "@/components/ui";
import { initialState } from "@/lib/action-state";

export function AdjustCreditsForm() {
  const [state, action] = useActionState(adjustCreditsAction, initialState);
  return (
    <form action={action} className="space-y-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.ok}</Alert>}
      <Field label="E-mail do usuário" htmlFor="adm-email"><Input id="adm-email" name="email" type="email" required /></Field>
      <Field label="Créditos (+ adiciona, − remove)" htmlFor="adm-delta"><Input id="adm-delta" name="delta" type="number" required /></Field>
      <Field label="Motivo (obrigatório, vai para o extrato e auditoria)" htmlFor="adm-motivo"><Input id="adm-motivo" name="motivo" required minLength={5} maxLength={200} /></Field>
      <SubmitButton>Lançar ajuste</SubmitButton>
    </form>
  );
}

export function SetPlanForm() {
  const [state, action] = useActionState(setPlanAction, initialState);
  return (
    <form action={action} className="space-y-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.ok}</Alert>}
      <Field label="E-mail do usuário" htmlFor="plan-email"><Input id="plan-email" name="email" type="email" required /></Field>
      <Field label="Plano" htmlFor="plan-plano">
        <Select id="plan-plano" name="plano"><option value="pago">Pago</option><option value="teste">Teste grátis</option></Select>
      </Field>
      <SubmitButton variant="secondary">Alterar plano</SubmitButton>
    </form>
  );
}
