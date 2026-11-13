export default function Loading() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-ink-200" />
      <div className="h-28 animate-pulse rounded-2xl bg-ink-200" />
      <div className="h-28 animate-pulse rounded-2xl bg-ink-200" />
    </div>
  );
}
