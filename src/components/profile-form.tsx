"use client";

import { useActionState, useState } from "react";
import { onboardingAction, profileSettingsAction } from "@/app/actions/settings";
import { initialState } from "@/lib/action-state";
import { CIDADES_SUGERIDAS } from "@/lib/br";
import { OFFERS } from "@/lib/filters";
import { SubmitButton } from "./submit-button";
import { Alert, Button, Field, Input, Textarea, cx } from "./ui";

export interface ProfileValues {
  ofertas: string[];
  nichos_aceitos: string[];
  nichos_excluidos: string[];
  porte: string;
  regiao: { tipo: string; cidade?: string; uf?: string };
  estilo_mensagem: string;
  sobre_mim: string;
}

const STEPS = ["O que você vende?", "Quem você quer atender?", "Onde?", "Seu estilo de mensagem"];

function Choice({ name, value, label, type, defaultChecked, desc }: { name: string; value: string; label: string; type: "radio" | "checkbox"; defaultChecked: boolean; desc?: string }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-ink-200 bg-white px-3 py-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
      <input type={type} name={name} value={value} defaultChecked={defaultChecked} className="mt-0.5 size-5 shrink-0 accent-brand-600" />
      <span>
        <span className="font-semibold">{label}</span>
        {desc && <span className="block text-sm text-ink-600">{desc}</span>}
      </span>
    </label>
  );
}

export function ProfileForm({ values, mode, plano }: { values: ProfileValues; mode: "onboarding" | "settings"; plano: string }) {
  const [state, action] = useActionState(mode === "onboarding" ? onboardingAction : profileSettingsAction, initialState);
  const [step, setStep] = useState(0);
  const [regiao, setRegiao] = useState(values.regiao.tipo === "cidade" ? "cidade" : "brasil");
  const wizard = mode === "onboarding";
  const show = (i: number) => !wizard || step === i;

  return (
    <form action={action} className="space-y-6">
      {wizard && (
        <div>
          <p className="text-sm font-semibold text-ink-500">
            Passo {step + 1} de {STEPS.length}
          </p>
          <div className="mt-2 flex gap-1.5" aria-hidden>
            {STEPS.map((_, i) => (
              <span key={i} className={cx("h-1.5 flex-1 rounded-full", i <= step ? "bg-brand-600" : "bg-ink-200")} />
            ))}
          </div>
        </div>
      )}
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.ok}</Alert>}

      <fieldset hidden={!show(0)} className="space-y-3">
        <legend className="mb-3 text-xl font-bold">{STEPS[0]}</legend>
        <p className="text-ink-600">Pode marcar mais de um. Isso ajusta os filtros e as mensagens.</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {OFFERS.map((o) => (
            <Choice key={o.id} type="checkbox" name="ofertas" value={o.id} label={o.nome} defaultChecked={values.ofertas.includes(o.id)} />
          ))}
        </div>
      </fieldset>

      <fieldset hidden={!show(1)} className="space-y-4">
        <legend className="mb-3 text-xl font-bold">{STEPS[1]}</legend>
        <Field label="Nichos que você prefere (opcional)" htmlFor="nichos_aceitos" hint="Separe por vírgula. Vazio = qualquer nicho.">
          <Input id="nichos_aceitos" name="nichos_aceitos" defaultValue={values.nichos_aceitos.join(", ")} placeholder="Ex.: restaurante, academia" />
        </Field>
        <Field label="Nichos que você NÃO quer atender" htmlFor="nichos_excluidos" hint="Leads desses nichos nunca aparecem e nunca são cobrados.">
          <Input id="nichos_excluidos" name="nichos_excluidos" defaultValue={values.nichos_excluidos.join(", ")} placeholder="Ex.: advocacia" />
        </Field>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink-700">Porte das empresas</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["qualquer", "Qualquer"],
              ["pequeno", "Pequeno"],
              ["medio", "Médio"],
              ["grande", "Grande"],
            ].map(([v, l]) => (
              <Choice key={v} type="radio" name="porte" value={v!} label={l!} defaultChecked={values.porte === v} />
            ))}
          </div>
          <p className="text-sm text-ink-500">O Google não informa o porte com precisão; usamos como preferência, não como filtro rígido.</p>
        </div>
      </fieldset>

      <fieldset hidden={!show(2)} className="space-y-3">
        <legend className="mb-3 text-xl font-bold">{STEPS[2]}</legend>
        <div className="grid grid-cols-1 gap-2">
          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-ink-200 bg-white px-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
            <input type="radio" name="regiao" value="brasil" checked={regiao === "brasil"} onChange={() => setRegiao("brasil")} className="size-5 accent-brand-600" />
            <span className="font-semibold">Brasil todo</span>
          </label>
          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-ink-200 bg-white px-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
            <input type="radio" name="regiao" value="cidade" checked={regiao === "cidade"} onChange={() => setRegiao("cidade")} className="size-5 accent-brand-600" />
            <span>
              <span className="font-semibold">Uma cidade</span>
              {plano === "teste" && <span className="block text-sm text-ink-600">No teste grátis a busca é no Brasil todo. A cidade vale quando você assinar.</span>}
            </span>
          </label>
          <div className="flex min-h-12 items-center gap-3 rounded-xl border border-dashed border-ink-200 px-3 text-ink-500">
            <span className="font-semibold">Exterior</span>
            <span className="text-sm">chega em breve</span>
          </div>
        </div>
        {regiao === "cidade" && (
          <Field label="Cidade" htmlFor="cidade" hint="Ex.: Curitiba - PR">
            <Input id="cidade" name="cidade" list="cidades" defaultValue={values.regiao.cidade ? `${values.regiao.cidade}${values.regiao.uf ? ` - ${values.regiao.uf}` : ""}` : ""} />
          </Field>
        )}
        <datalist id="cidades">
          {CIDADES_SUGERIDAS.map((c) => (
            <option key={c.cidade} value={`${c.cidade} - ${c.uf}`} />
          ))}
        </datalist>
      </fieldset>

      <fieldset hidden={!show(3)} className="space-y-4">
        <legend className="mb-3 text-xl font-bold">{STEPS[3]}</legend>
        <div className="grid grid-cols-1 gap-2">
          <Choice type="radio" name="estilo_mensagem" value="amigavel" label="Amigável" desc="“Oi, pessoal da Padaria Sol! Tudo bem?”" defaultChecked={values.estilo_mensagem === "amigavel"} />
          <Choice type="radio" name="estilo_mensagem" value="formal" label="Formal" desc="“Bom dia, equipe Padaria Sol.”" defaultChecked={values.estilo_mensagem === "formal"} />
          <Choice type="radio" name="estilo_mensagem" value="direto" label="Direto" desc="Frases curtas, sem rodeios." defaultChecked={values.estilo_mensagem === "direto"} />
        </div>
        <Field label="Sobre você e seu serviço" htmlFor="sobre_mim" hint="Uma ou duas frases. A IA usa só o que você escrever aqui (nada de números ou preços inventados).">
          <Textarea id="sobre_mim" name="sobre_mim" maxLength={600} defaultValue={values.sobre_mim} placeholder="Ex.: Faço vídeos animados para negócios locais mostrarem seus produtos nas redes." />
        </Field>
      </fieldset>

      {wizard ? (
        <div className="flex gap-3">
          {step > 0 && (
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setStep(step - 1)}>
              Voltar
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" className="flex-1" onClick={() => setStep(step + 1)}>
              Continuar
            </Button>
          ) : (
            <SubmitButton className="flex-1" pendingText="Salvando…">
              Começar a buscar
            </SubmitButton>
          )}
        </div>
      ) : (
        <SubmitButton pendingText="Salvando…">Salvar preferências</SubmitButton>
      )}
    </form>
  );
}
