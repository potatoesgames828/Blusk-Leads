import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { ProfileForm } from "@/components/profile-form";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db";
import { loadProfile, loadWorkspace } from "@/lib/queries";

export const metadata = { title: "Configurar conta" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const { profile, ws } = await withUser(user.id, async (tx) => ({ profile: await loadProfile(tx), ws: await loadWorkspace(tx) }));
  if (ws.onboarding_concluido_em) redirect("/hoje");
  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <Logo href="/onboarding" />
      <h1 className="mt-6 text-2xl font-bold tracking-tight">Vamos ajustar o Blusk Leads para você</h1>
      <p className="mt-1 text-ink-600">Leva menos de um minuto. Dá para mudar tudo depois em Ajustes.</p>
      <div className="mt-6">
        <ProfileForm values={{ ...profile, ofertas: profile.ofertas.length ? profile.ofertas : ["motion"] }} mode="onboarding" plano={ws.plano} />
      </div>
    </div>
  );
}
