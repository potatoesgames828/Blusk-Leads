import { RemovalForm } from "./removal-form";

export const metadata = { title: "Remover minha empresa" };

export default function RemovePage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Remover minha empresa</h1>
      <p className="mt-2 text-ink-600">
        Se a sua empresa recebeu uma mensagem de alguém que usa o Blusk Leads e você não quer mais ser contatado por esse
        caminho, preencha abaixo. O bloqueio é <strong>imediato</strong> e vale para <strong>todas as contas</strong> e
        buscas futuras.
      </p>
      <div className="mt-6 rounded-2xl border border-ink-200 bg-white p-5">
        <RemovalForm />
      </div>
      <p className="mt-4 text-sm text-ink-500">
        Usamos o telefone apenas para identificar a empresa: guardamos uma versão cifrada (hash) e os 4 últimos dígitos.
        Pedidos claramente abusivos (por exemplo, de terceiros) podem ser revisados pela nossa equipe.
      </p>
    </div>
  );
}
