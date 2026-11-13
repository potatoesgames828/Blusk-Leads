import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-bold tracking-tight text-ink-900" aria-label="Blusk Leads, início">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#3443d9" />
        <path d="M10 8h7.5a5 5 0 0 1 2.9 9.1A5.5 5.5 0 0 1 18 27h-8z" fill="#fff" />
        <circle cx="16" cy="13" r="2" fill="#3443d9" />
        <circle cx="16.5" cy="21.5" r="2.3" fill="#3443d9" />
      </svg>
      <span className="text-lg">
        Blusk <span className="text-brand-600">Leads</span>
      </span>
    </Link>
  );
}
