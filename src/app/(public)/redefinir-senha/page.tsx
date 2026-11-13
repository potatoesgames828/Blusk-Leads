import { ResetPasswordForm } from "@/components/auth-forms";
import { Alert } from "@/components/ui";
import { AuthShell } from "../auth-shell";

export const metadata = { title: "Nova senha" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthShell title="Criar nova senha">
      {token ? <ResetPasswordForm token={token} /> : <Alert tone="error">Link incompleto. Abra de novo o link do e-mail.</Alert>}
    </AuthShell>
  );
}
