import Link from "next/link";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { Logo } from "@/components/logo";
import { FakeDataBanner } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db";
import { loadWorkspace } from "@/lib/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const ws = await withUser(user.id, loadWorkspace);
  if (!ws.onboarding_concluido_em) redirect("/onboarding");

  return (
    <div className="min-h-dvh pb-24">
      <FakeDataBanner />
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2.5">
          <Logo href="/hoje" />
          <div className="flex items-center gap-1">
            <Link
              href="/saldo"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand-50 px-3 text-sm font-bold text-brand-700 hover:bg-brand-100"
              aria-label={`Saldo: ${ws.saldo} créditos${ws.plano === "teste" ? ", teste grátis" : ""}`}
            >
              <span aria-hidden>●</span> {ws.saldo} <span className="font-semibold">créditos</span>
            </Link>
            {user.role === "admin" && (
              <Link href="/admin" className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-ink-700 hover:bg-ink-100">
                Admin
              </Link>
            )}
            <Link href="/ajustes" className="inline-flex size-11 items-center justify-center rounded-full text-ink-700 hover:bg-ink-100" aria-label="Ajustes e perfil">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
              </svg>
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
      <BottomNav />
    </div>
  );
}
