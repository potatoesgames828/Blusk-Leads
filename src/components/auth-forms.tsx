"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction, loginAction, resendConfirmationAction, resetPasswordAction, signupAction } from "@/app/actions/auth";
import { initialState } from "@/lib/action-state";
import { SubmitButton } from "./submit-button";
import { Alert, Field, Input } from "./ui";

export function SignupForm() {
  const [state, action] = useActionState(signupAction, initialState);
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Seu nome" htmlFor="nome">
        <Input id="nome" name="nome" autoComplete="name" required minLength={2} maxLength={80} />
      </Field>
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Senha" htmlFor="senha" hint="Pelo menos 8 caracteres, com letras e números.">
        <Input id="senha" name="senha" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <label className="flex items-start gap-3 text-[15px] text-ink-700">
        <input type="checkbox" name="termos" required className="mt-1 size-5 accent-brand-600" />
        <span>
          Li e aceito os{" "}
          <Link href="/termos" className="font-semibold text-brand-700 underline" target="_blank">
            Termos de Uso
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" className="font-semibold text-brand-700 underline" target="_blank">
            Política de Privacidade
          </Link>
          .
        </span>
      </label>
      <SubmitButton className="w-full" pendingText="Criando conta…">
        Criar conta grátis
      </SubmitButton>
    </form>
  );
}

export function LoginForm() {
  const [state, action] = useActionState(loginAction, initialState);
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Senha" htmlFor="senha">
        <Input id="senha" name="senha" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton className="w-full" pendingText="Entrando…">
        Entrar
      </SubmitButton>
    </form>
  );
}

export function ResendConfirmationForm() {
  const [state, action] = useActionState(resendConfirmationAction, initialState);
  return (
    <form action={action} className="space-y-3">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.ok}</Alert>}
      <SubmitButton variant="secondary" className="w-full" pendingText="Enviando…">
        Reenviar e-mail de confirmação
      </SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, initialState);
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.ok}</Alert>}
      <Field label="E-mail da conta" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <SubmitButton className="w-full" pendingText="Enviando…">
        Enviar link
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, initialState);
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="token" value={token} />
      <Field label="Nova senha" htmlFor="senha" hint="Pelo menos 8 caracteres, com letras e números.">
        <Input id="senha" name="senha" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <SubmitButton className="w-full" pendingText="Salvando…">
        Salvar nova senha
      </SubmitButton>
    </form>
  );
}
