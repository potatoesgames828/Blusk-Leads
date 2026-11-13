import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-ink-300",
  secondary: "bg-white text-ink-900 border border-ink-200 hover:bg-ink-100 disabled:text-ink-500",
  ghost: "text-ink-700 hover:bg-ink-100",
  danger: "bg-white text-red-700 border border-red-200 hover:bg-red-50",
};

export const buttonClass = (variant: Variant = "primary", extra?: string) =>
  cx(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed",
    variants[variant],
    extra,
  );

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function LinkButton({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-2xl border border-ink-200 bg-white p-4", className)} {...props} />;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-ink-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink-700">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-sm text-ink-500">{hint}</p>}
      {error && (
        <p className="text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "block w-full min-h-11 rounded-xl border border-ink-300 bg-white px-3 text-base text-ink-900 placeholder:text-ink-500 focus:border-brand-500";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={cx(inputClass, "min-h-24 py-2", props.className)} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={cx(inputClass, props.className)} />;
}

export function Alert({ tone = "info", children }: { tone?: "info" | "success" | "warning" | "error"; children: ReactNode }) {
  const tones = {
    info: "bg-brand-50 text-brand-900 border-brand-200",
    success: "bg-emerald-50 text-emerald-900 border-emerald-200",
    warning: "bg-amber-50 text-amber-900 border-amber-200",
    error: "bg-red-50 text-red-900 border-red-200",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-xl border px-3 py-2.5 text-[15px]", tones[tone])}>
      {children}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-300 bg-white px-5 py-10 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-sm text-ink-600">{children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

const TEMP = {
  quente: { label: "Quente", cls: "bg-orange-50 text-hot border-orange-200" },
  morno: { label: "Morno", cls: "bg-amber-50 text-warm border-amber-200" },
  frio: { label: "Frio", cls: "bg-sky-50 text-cold border-sky-200" },
} as const;

export function TempBadge({ temp, score }: { temp: keyof typeof TEMP; score?: number }) {
  const t = TEMP[temp];
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold", t.cls)}>
      {score !== undefined && <span aria-hidden>{score}</span>}
      {t.label}
      {score !== undefined && <span className="sr-only">, nota {score} de 100</span>}
    </span>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center rounded-full bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-700", className)}>{children}</span>;
}

export function FakeDataBanner() {
  if (process.env.LEAD_PROVIDER === "google_places") return null;
  return (
    <div className="bg-amber-100 px-4 py-1.5 text-center text-xs font-semibold text-amber-900">
      Ambiente de desenvolvimento: os leads são FICTÍCIOS e os telefones não existem.
    </div>
  );
}
