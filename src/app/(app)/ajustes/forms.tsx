"use client";

import { useActionState } from "react";
import { deleteAccountAction } from "@/app/actions/account";
import { cadenceAction, nameAction, scoreWeightsAction, stageRenameAction } from "@/app/actions/settings";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field, Input } from "@/components/ui";
import { initialState, type ActionState } from "@/lib/action-state";

function Feedback({ state }: { state: ActionState }) {
  if (state.error) return <Alert tone="error">{state.error}</Alert>;
  if (state.ok) return <Alert tone="success">{state.ok}</Alert>;
  return null;
}

export function NameForm({ nome }: { nome: string }) {
  const [state, action] = useActionState(nameAction, initialState);
  return (
    <form action={action} className="space-y-3">
      <Feedback state={state} />
      <Field label="Seu nome" htmlFor="nome-perfil" hint="Usado para assinar as mensagens.">
        <Input id="nome-perfil" name="nome" defaultValue={nome} required minLength={2} maxLength={80} />
      </Field>
      <SubmitButton variant="secondary">Salvar nome</SubmitButton>
    </form>
  );
}

export function CadenceForm({ dias }: { dias: number[] }) {
  const [state, action] = useActionState(cadenceAction, initialState);
  return (
    <form action={action} className="space-y-3">
      <Feedback state={state} />
      <Field label="Intervalos entre follow-ups (dias)" htmlFor="cadencia" hint="Ao marcar um lead como “Contatado”, criamos lembretes com esses intervalos. Ex.: 3, 5, 7">
        <Input id="cadencia" name="cadencia" defaultValue={dias.join(", ")} required />
      </Field>
      <SubmitButton variant="secondary">Salvar cadência</SubmitButton>
    </form>
  );
}

export function WeightsForm({ rules }: { rules: { chave: string; nome: string; descricao: string; padrao: number; atual: number }[] }) {
  const [state, action] = useActionState(scoreWeightsAction, initialState);
  return (
    <form action={action} className="space-y-3">
      <Feedback state={state} />
      <ul className="divide-y divide-ink-100">
        {rules.map((r) => (
          <li key={r.chave} className="flex items-center justify-between gap-3 py-2.5">
            <label htmlFor={`peso_${r.chave}`} className="min-w-0">
              <span className="font-semibold">{r.nome}</span>
              <span className="block text-sm text-ink-600">{r.descricao} Padrão: {r.padrao > 0 ? `+${r.padrao}` : r.padrao}.</span>
            </label>
            <Input id={`peso_${r.chave}`} name={`peso_${r.chave}`} type="number" min={-50} max={50} step={1} defaultValue={r.atual} className="w-20 text-right" />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <SubmitButton variant="secondary">Salvar pesos</SubmitButton>
        <SubmitButton variant="ghost" name="restaurar" value="1">Restaurar padrão</SubmitButton>
      </div>
    </form>
  );
}

export function StagesForm({ stages }: { stages: { id: string; nome: string; ordem: number; tipo: string }[] }) {
  const [state, action] = useActionState(stageRenameAction, initialState);
  return (
    <form action={action} className="space-y-3">
      <Feedback state={state} />
      <ul className="space-y-2">
        {stages.map((s) => (
          <li key={s.id} className="flex items-center gap-2">
            <label className="sr-only" htmlFor={`stage_${s.id}_ordem`}>Posição de {s.nome}</label>
            <Input id={`stage_${s.id}_ordem`} name={`stage_${s.id}_ordem`} type="number" min={0} max={20} defaultValue={s.ordem} className="w-16 text-center" />
            <label className="sr-only" htmlFor={`stage_${s.id}_nome`}>Nome da etapa</label>
            <Input id={`stage_${s.id}_nome`} name={`stage_${s.id}_nome`} defaultValue={s.nome} maxLength={40} required />
            {s.tipo !== "aberto" && <span className="shrink-0 text-xs font-semibold text-ink-500">{s.tipo === "ganho" ? "ganho" : "perdido"}</span>}
          </li>
        ))}
      </ul>
      <SubmitButton variant="secondary">Salvar etapas</SubmitButton>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccountAction, initialState);
  return (
    <form action={action} className="space-y-3">
      <Feedback state={state} />
      <p className="text-[15px] text-ink-700">Apaga sua conta, leads, mensagens e histórico. Não dá para desfazer.</p>
      <Field label="Digite EXCLUIR para confirmar" htmlFor="confirmacao">
        <Input id="confirmacao" name="confirmacao" autoComplete="off" required />
      </Field>
      <Field label="Sua senha" htmlFor="senha-excluir">
        <Input id="senha-excluir" name="senha" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton variant="danger" pendingText="Excluindo…">Excluir minha conta</SubmitButton>
    </form>
  );
}
