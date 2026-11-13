import { LegalPage } from "../legal";

export const metadata = { title: "Termos de Uso" };

export default function TermsPage() {
  return (
    <LegalPage title="Termos de Uso" updated="13 de novembro de 2026">
      <p>Ao criar uma conta no <strong>Blusk Leads</strong>, você concorda com estes termos.</p>

      <h2>1. O serviço</h2>
      <p>
        O Blusk Leads ajuda você a encontrar empresas, preparar mensagens de abordagem, acompanhar negociações e organizar
        projetos. As informações sobre empresas vêm de fontes oficiais e podem estar desatualizadas; não garantimos que
        um contato resulte em venda.
      </p>

      <h2>2. Uso responsável</h2>
      <ul>
        <li>O envio de mensagens é feito por você, manualmente, pelo seu WhatsApp ou e-mail.</li>
        <li>É proibido usar o Blusk Leads para spam, disparo em massa, assédio ou qualquer prática ilegal.</li>
        <li>Respeite quem pedir para não ser contatado. Não insista.</li>
        <li>Siga as regras do WhatsApp e das demais plataformas que você usar.</li>
      </ul>

      <h2>3. Créditos</h2>
      <ul>
        <li>Cada lead novo entregue consome créditos conforme a tabela vigente.</li>
        <li>Leads repetidos não são cobrados. Buscas com erro não são cobradas. Buscas que entregam menos leads cobram só os entregues.</li>
        <li>Toda movimentação aparece no extrato da sua conta.</li>
        <li>O teste grátis inclui uma quantidade limitada de leads, sem cartão.</li>
      </ul>

      <h2>4. Exclusividade de leads</h2>
      <p>
        Um lead entregue a você fica reservado só para a sua conta por um período (hoje, 30 dias). Depois disso, pode ser
        entregue a outras contas.
      </p>

      <h2>5. Mensagens sugeridas</h2>
      <p>
        As mensagens são sugestões geradas a partir de dados públicos. Revise sempre antes de enviar. Você é responsável
        pelo que envia.
      </p>

      <h2>6. Planos e cancelamento</h2>
      <p>
        Planos pagos podem ser cancelados a qualquer momento, sem multa e sem fidelidade. O acesso continua até o fim do
        período pago, e seus leads e projetos continuam na sua conta.
      </p>

      <h2>7. Suspensão</h2>
      <p>Podemos suspender contas que violem estes termos, especialmente em casos de spam ou abuso.</p>

      <h2>8. Contato e foro</h2>
      <p>
        Dados de contato e foro serão publicados aqui antes do lançamento comercial. Estes termos seguem a legislação
        brasileira, incluindo o Código de Defesa do Consumidor quando aplicável.
      </p>
    </LegalPage>
  );
}
