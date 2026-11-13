"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

const tabs = [
  { href: "/hoje", label: "Hoje", d: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { href: "/buscar", label: "Buscar", d: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5" },
  { href: "/crm", label: "CRM", d: "M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v6h-4z" },
  { href: "/projetos", label: "Projetos", d: "M3 7h18v13H3zM8 7V4h8v3" },
  { href: "/aprender", label: "Aprender", d: "M2 8l10-4 10 4-10 4zM6 10v5c3 2 9 2 12 0v-5" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Navegação principal" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white">
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {tabs.map((t) => {
          const active = path === t.href || path.startsWith(`${t.href}/`) || (t.href === "/crm" && path.startsWith("/leads"));
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold",
                  active ? "text-brand-700" : "text-ink-500 hover:text-ink-900",
                )}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={t.d} />
                </svg>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
