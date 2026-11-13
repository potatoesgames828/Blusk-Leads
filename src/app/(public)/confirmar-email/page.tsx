import Link from "next/link";
import { redirect } from "next/navigation";
import { confirmEmailAction } from "@/app/actions/auth";
import { ResendConfirmationForm } from "@/components/auth-forms";
import { Alert, LinkButton } from "@/components/ui";
import { currentUser } from "@/lib/auth/session";
import { AuthShell } from "../auth-shell";

export const metadata = { title: "Confirmar e-mail" };

export default async function ConfirmEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (token) {
    const ok = await confirmEmailAction(token);
    return (
      <AuthShell title={ok ? "E-mail confirmado" : "Link inválido"}>
        {ok ? (
          <div className="space-y-4">
            <Alert tone="success">Tudo certo! Sua conta está ativa.</Alert>
            <LinkButton href="/onboarding" className="w-full">Continuar</LinkButton>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert tone="error">Este link expirou ou já foi usado. Entre na sua conta e peça um novo.</Alert>
            <LinkButton href="/entrar" variant="secondary" className="w-full">Entrar</LinkButton>
          </div>
        )}
      </AuthShell>
    );
  }
  const user = await currentUser();
  if (!user) redirect("/entrar");
  if (user.emailConfirmado) redirect("/hoje");
  return (
    <AuthShell title="Confirme seu e-mail" subtitle={<>Enviamos um link para <strong>{user.email}</strong>. Abra o e-mail e toque no link para ativar a conta.</>}>
      <ResendConfirmationForm />
      {process.env.NODE_ENV !== "production" && (
        <p className="mt-4 text-center text-sm text-ink-600">
          Em desenvolvimento os e-mails ficam na <Link href="/dev/emails" className="font-semibold text-brand-700 underline">caixa de dev</Link>.
        </p>
      )}
    </AuthShell>
  );
}
