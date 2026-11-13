"use client";

import { useActionState } from "react";
import { removalAction } from "@/app/actions/public";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field, Input, Textarea } from "@/components/ui";
import { initialState } from "@/lib/action-state";

export function RemovalForm() {
  const [state, action] = useActionState(removalAction, initialState);
  if (state.ok) return <Alert tone="success">{state.ok}</Alert>;
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Nome da empresa" htmlFor="nome_empresa">
        <Input id="nome_empresa" name="nome_empresa" required maxLength={120} />
      </Field>
      <Field label="Telefone da empresa, com DDD" htmlFor="telefone" hint="O mesmo que aparece no Google. Ex.: (11) 98765-4321">
        <Input id="telefone" name="telefone" type="tel" inputMode="tel" autoComplete="tel" required />
      </Field>
      <Field label="Cidade (opcional)" htmlFor="cidade">
        <Input id="cidade" name="cidade" maxLength={80} />
      </Field>
      <Field label="E-mail para confirmação (opcional)" htmlFor="email">
        <Input id="email" name="email" type="email" maxLength={200} />
      </Field>
      <Field label="Observação (opcional)" htmlFor="mensagem">
        <Textarea id="mensagem" name="mensagem" maxLength={1000} />
      </Field>
      <SubmitButton className="w-full" pendingText="Enviando…">
        Remover minha empresa
      </SubmitButton>
    </form>
  );
}
