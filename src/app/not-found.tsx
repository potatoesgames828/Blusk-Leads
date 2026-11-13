import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="mt-2 text-ink-600">O endereço pode estar errado ou o item não existe mais.</p>
      <div className="mt-6 flex justify-center"><LinkButton href="/hoje">Voltar ao início</LinkButton></div>
    </div>
  );
}
