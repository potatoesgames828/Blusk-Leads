"use client";

import { Button } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center" role="alert">
      <h1 className="text-2xl font-bold">Algo deu errado</h1>
      <p className="mt-2 text-ink-600">Não conseguimos carregar esta tela. Seus dados estão seguros. Tente de novo.</p>
      <div className="mt-6 flex justify-center"><Button onClick={reset}>Tentar de novo</Button></div>
    </div>
  );
}
