import type { ReactNode } from "react";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-ink-600">{subtitle}</p>}
      <div className="mt-6 rounded-2xl border border-ink-200 bg-white p-5">{children}</div>
      {footer && <div className="mt-4 text-center text-[15px] text-ink-600">{footer}</div>}
    </div>
  );
}
