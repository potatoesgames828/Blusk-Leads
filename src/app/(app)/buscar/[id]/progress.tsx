"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function SearchProgress({ id, pedidos }: { id: string; pedidos: number }) {
  const router = useRouter();
  const [entregues, setEntregues] = useState(0);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let stop = false;
    let errors = 0;
    async function tick() {
      try {
        const res = await fetch(`/api/searches/${id}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data: { status: string; entregues: number } = await res.json();
        errors = 0;
        setEntregues(data.entregues);
        if (data.status !== "na_fila" && data.status !== "rodando") {
          router.refresh();
          return;
        }
      } catch {
        if (++errors >= 5) {
          setFalhou(true);
          return;
        }
      }
      if (!stop) setTimeout(tick, 1200);
    }
    tick();
    return () => {
      stop = true;
    };
  }, [id, router]);

  const pct = Math.round((entregues / pedidos) * 100);
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-5" role="status" aria-live="polite">
      <p className="font-semibold">{falhou ? "Não conseguimos acompanhar a busca." : "Buscando empresas reais…"}</p>
      <p className="mt-1 text-sm text-ink-600">
        {falhou ? "Recarregue a página em alguns segundos." : `${entregues} de ${pedidos} leads encontrados até agora.`}
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100">
        <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${Math.max(4, pct)}%` }} />
      </div>
    </div>
  );
}
