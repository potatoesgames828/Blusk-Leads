import { logoutAction } from "@/app/actions/auth";
import { logoutEverywhereAction } from "@/app/actions/account";
import { ProfileForm } from "@/components/profile-form";
import { Card, PageHeader, buttonClass } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db";
import { loadProfile, loadWorkspace } from "@/lib/queries";
import { SCORE_RULES } from "@/lib/score/rules";
import { CadenceForm, DeleteAccountForm, NameForm, StagesForm, WeightsForm } from "./forms";

export const metadata = { title: "Ajustes" };

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-20">
      <Card>
        <h2 id={id} className="mb-3 text-lg font-bold">{title}</h2>
        {children}
      </Card>
    </section>
  );
}

export default async function SettingsPage() {
  const user = await requireUser();
  const { profile, ws, weights, stages } = await withUser(user.id, async (tx) => ({
    profile: await loadProfile(tx),
    ws: await loadWorkspace(tx),
    weights: await tx<{ regra: string; peso: number }[]>`select regra, peso from workspace_score_weights`,
    stages: await tx<{ id: string; nome: string; ordem: number; tipo: string }[]>`select id, nome, ordem, tipo from pipeline_stages order by ordem`,
  }));
  const w = Object.fromEntries(weights.map((x) => [x.regra, x.peso]));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Ajustes" subtitle={user.email} />
      <Section id="s-oferta" title="Oferta, nichos e estilo">
        <ProfileForm values={profile} mode="settings" plano={ws.plano} />
      </Section>
      <Section id="s-score" title="Pesos do score">
        <p className="mb-2 text-[15px] text-ink-600">Cada regra soma ou tira pontos da nota (base 30, limite 0 a 100). Peso 0 desliga a regra. Vale para as próximas buscas.</p>
        <WeightsForm rules={SCORE_RULES.map((r) => ({ chave: r.chave, nome: r.nome, descricao: r.descricao, padrao: r.pesoPadrao, atual: w[r.chave] ?? r.pesoPadrao }))} />
      </Section>
      <Section id="s-cadencia" title="Cadência de follow-up">
        <CadenceForm dias={profile.cadencia_followup} />
      </Section>
      <Section id="s-etapas" title="Etapas do CRM">
        <p className="mb-2 text-[15px] text-ink-600">Renomeie e reordene as colunas (a posição define a ordem).</p>
        <StagesForm stages={stages} />
      </Section>
      <Section id="s-dados" title="Dados pessoais">
        <NameForm nome={user.nome} />
      </Section>
      <Section id="s-privacidade" title="Privacidade e conta">
        <div className="space-y-4">
          <a href="/api/conta/exportar" className={buttonClass("secondary")}>Exportar meus dados (JSON)</a>
          <div className="flex flex-wrap gap-2">
            <form action={logoutAction}><button className={buttonClass("secondary")}>Sair</button></form>
            <form action={logoutEverywhereAction}><button className={buttonClass("ghost")}>Sair de todos os aparelhos</button></form>
          </div>
          <details className="rounded-xl border border-red-200 p-3">
            <summary className="cursor-pointer font-semibold text-red-800">Excluir conta</summary>
            <div className="mt-3"><DeleteAccountForm /></div>
          </details>
        </div>
      </Section>
    </div>
  );
}
