import Link from "next/link";
import { Logo } from "@/components/logo";
import { currentUser } from "@/lib/auth/session";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <nav className="flex items-center gap-1 text-[15px] font-semibold">
            {user ? (
              <Link href="/hoje" className="rounded-lg px-3 py-2 text-brand-700 hover:bg-brand-50">
                Abrir o app
              </Link>
            ) : (
              <>
                <Link href="/entrar" className="rounded-lg px-3 py-2 text-ink-700 hover:bg-ink-100">
                  Entrar
                </Link>
                <Link href="/cadastrar" className="rounded-lg bg-brand-600 px-3 py-2 text-white hover:bg-brand-700">
                  Testar grátis
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-ink-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-ink-600 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Blusk Leads</p>
          <nav className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/privacidade" className="hover:text-ink-900">Política de Privacidade</Link>
            <Link href="/termos" className="hover:text-ink-900">Termos de Uso</Link>
            <Link href="/remover-empresa" className="font-semibold hover:text-ink-900">Remover minha empresa</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
