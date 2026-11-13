import { LinkButton } from "@/components/ui";

const steps = [
  { n: "1", t: "Escolha nicho e cidade", d: "Buscamos empresas reais na fonte oficial do Google e filtramos pelo que você vende." },
  { n: "2", t: "Veja quem abordar primeiro", d: "Cada lead ganha uma nota de 0 a 100 com recibo: você vê exatamente de onde veio cada ponto." },
  { n: "3", t: "Mande a mensagem em um toque", d: "Mensagem pronta que cita um fato real do negócio. Você revisa e envia pelo seu WhatsApp." },
  { n: "4", t: "Acompanhe até fechar", d: "CRM em quadro, lembretes de follow-up e histórico completo de cada lead." },
];

const promises = [
  { t: "Dados reais, nunca inventados", d: "Se uma informação não existe, mostramos “não disponível”. Nenhum número fabricado." },
  { t: "Você no controle", d: "Nada é enviado sem o seu toque. Sem disparo em massa, sem risco para o seu número." },
  { t: "Crédito justo", d: "Lead repetido não é cobrado. Busca com erro não é cobrada. Tudo aparece no seu extrato." },
  { t: "Respeito à LGPD", d: "Só dados públicos de empresas, e qualquer empresa pode pedir para sair da base." },
];

export default function Home() {
  return (
    <div>
      <section className="mx-auto max-w-5xl px-4 pb-12 pt-12 sm:pt-20">
        <p className="text-sm font-bold uppercase tracking-wider text-brand-600">Para freelancers e estúdios criativos</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Encontre clientes reais e saiba exatamente quem abordar primeiro.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-600">
          O Blusk Leads busca empresas por nicho e cidade, explica por que cada uma combina com o seu serviço e prepara a
          primeira mensagem. Você só toca para enviar.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <LinkButton href="/cadastrar" className="px-6 text-base">Testar grátis com 5 leads</LinkButton>
          <LinkButton href="/entrar" variant="secondary" className="px-6 text-base">Já tenho conta</LinkButton>
        </div>
        <p className="mt-3 text-sm text-ink-500">Sem cartão de crédito.</p>
      </section>

      <section className="border-y border-ink-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <h2 className="text-2xl font-bold tracking-tight">Como funciona</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <li key={s.n} className="rounded-2xl border border-ink-200 p-4">
                <span className="flex size-8 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{s.n}</span>
                <p className="mt-3 font-semibold">{s.t}</p>
                <p className="mt-1 text-[15px] text-ink-600">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-2xl font-bold tracking-tight">Nossos compromissos</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {promises.map((p) => (
            <div key={p.t} className="rounded-2xl border border-ink-200 bg-white p-4">
              <p className="font-semibold">{p.t}</p>
              <p className="mt-1 text-[15px] text-ink-600">{p.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
