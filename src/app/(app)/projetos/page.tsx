import { EmptyState, LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "Projetos" };

export default function ProjectsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Projetos" subtitle="Da proposta à entrega, com valor, custo e lucro de cada trabalho." />
      <EmptyState title="Chega em breve" action={<LinkButton href="/crm" variant="secondary">Ir para o CRM</LinkButton>}>
        Quando um lead virar “Fechado (ganho)”, você vai poder criar o projeto com um toque, com checklist de entrega,
        rodadas de revisão, financeiro e proposta em PDF.
      </EmptyState>
    </div>
  );
}
