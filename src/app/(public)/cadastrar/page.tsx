import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth-forms";
import { currentUser } from "@/lib/auth/session";
import { AuthShell } from "../auth-shell";

export const metadata = { title: "Criar conta" };

export default async function SignupPage() {
  if (await currentUser()) redirect("/hoje");
  return (
    <AuthShell
      title="Teste grátis, sem cartão"
      subtitle="Você ganha 5 leads para conhecer o Blusk Leads."
      footer={
        <>
          Já tem conta? <Link href="/entrar" className="font-semibold text-brand-700">Entrar</Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
