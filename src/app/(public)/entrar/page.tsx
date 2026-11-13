import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { Alert } from "@/components/ui";
import { currentUser } from "@/lib/auth/session";
import { AuthShell } from "../auth-shell";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ senha?: string }> }) {
  if (await currentUser()) redirect("/hoje");
  const { senha } = await searchParams;
  return (
    <AuthShell
      title="Entrar"
      footer={
        <div className="space-y-2">
          <p>
            <Link href="/recuperar-senha" className="font-semibold text-brand-700">Esqueci minha senha</Link>
          </p>
          <p>
            Ainda não tem conta? <Link href="/cadastrar" className="font-semibold text-brand-700">Teste grátis</Link>
          </p>
        </div>
      }
    >
      {senha === "redefinida" && (
        <div className="mb-4">
          <Alert tone="success">Senha alterada. Entre com a nova senha.</Alert>
        </div>
      )}
      <LoginForm />
    </AuthShell>
  );
}
