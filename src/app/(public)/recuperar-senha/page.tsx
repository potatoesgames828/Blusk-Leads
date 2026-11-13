import { ForgotPasswordForm } from "@/components/auth-forms";
import { AuthShell } from "../auth-shell";

export const metadata = { title: "Recuperar senha" };

export default function ForgotPage() {
  return (
    <AuthShell title="Recuperar senha" subtitle="Enviaremos um link para você criar uma nova senha.">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
