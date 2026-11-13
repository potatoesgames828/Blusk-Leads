import Link from "next/link";
import { LegalPage } from "../legal";

export const metadata = { title: "Política de Privacidade" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidade" updated="13 de novembro de 2026">
      <p>
        Esta política explica como o <strong>Blusk Leads</strong> trata dados pessoais, de acordo com a Lei Geral de
        Proteção de Dados (Lei nº 13.709/2018, “LGPD”). Escrevemos em linguagem simples de propósito.
      </p>

      <h2>1. Quem somos</h2>
      <p>
        O Blusk Leads é uma plataforma de prospecção, CRM e gestão de projetos para freelancers e pequenos estúdios.
        Os dados de identificação do controlador (razão social, CNPJ e endereço) e o contato do encarregado de dados
        serão publicados aqui antes do lançamento comercial.
      </p>

      <h2>2. Dados de quem usa o Blusk Leads</h2>
      <ul>
        <li>Cadastro: nome, e-mail e senha (guardada apenas como hash, nunca em texto).</li>
        <li>Configurações: o que você vende, nichos, estilo de mensagem e o texto “sobre você”.</li>
        <li>Uso: buscas, leads, mensagens geradas, etapas do CRM e extrato de créditos.</li>
        <li>Registros técnicos mínimos de segurança. Não guardamos seu IP em logs de uso.</li>
      </ul>
      <p>
        Base legal: execução do contrato (art. 7º, V) e cumprimento de obrigação legal (art. 7º, II). Registramos a
        versão dos Termos e desta Política que você aceitou.
      </p>

      <h2>3. Dados de empresas encontradas nas buscas</h2>
      <p>
        Coletamos apenas dados <strong>públicos de empresas</strong> disponibilizados por provedores oficiais (como a
        Google Places API): nome do negócio, categoria, endereço, telefone comercial, site, nota e número de avaliações.
        Não fazemos raspagem de sites nem de mapas. Quando um telefone comercial pertence a um profissional autônomo, ele
        pode ser dado pessoal; nesse caso a base legal é o <strong>legítimo interesse</strong> (art. 7º, IX) de oferecer
        serviços a empresas, com as salvaguardas abaixo:
      </p>
      <ul>
        <li>o contato é sempre manual, feito pelo próprio usuário, sem disparo automático em massa;</li>
        <li>toda mensagem sugerida inclui uma forma simples de não receber mais contatos;</li>
        <li>
          qualquer empresa pode pedir para sair em{" "}
          <Link href="/remover-empresa" className="font-semibold text-brand-700 underline">Remover minha empresa</Link>, e o
          bloqueio vale para todas as contas e buscas futuras.
        </li>
      </ul>

      <h2>4. Com quem compartilhamos</h2>
      <ul>
        <li>Provedores de infraestrutura (hospedagem e banco de dados).</li>
        <li>Provedor de dados de empresas (Google Places API), apenas com o texto da busca.</li>
        <li>Provedor de IA, apenas com os dados públicos do negócio e o texto que você escreveu sobre seu serviço, para gerar mensagens.</li>
        <li>Provedor de e-mail transacional, para confirmações e avisos.</li>
      </ul>
      <p>Não vendemos dados pessoais.</p>

      <h2>5. Por quanto tempo guardamos</h2>
      <p>
        Dados da conta: enquanto ela existir. Ao excluir a conta, apagamos seus dados em até 30 dias, exceto o que a lei
        obriga a manter. Dados de empresas obtidos do Google são renovados ou apagados conforme os termos do provedor.
        Pedidos de remoção ficam registrados para que o bloqueio continue valendo.
      </p>

      <h2>6. Seus direitos</h2>
      <p>
        Você pode confirmar o tratamento, acessar, corrigir, exportar e excluir seus dados, além de revogar
        consentimentos. Em <strong>Ajustes</strong> há botões para exportar seus dados e excluir sua conta.
      </p>

      <h2>7. Segurança</h2>
      <p>
        Usamos conexão criptografada, senhas com hash forte, isolamento de dados entre contas no próprio banco de dados e
        chaves de serviços guardadas apenas no servidor.
      </p>

      <h2>8. Mudanças</h2>
      <p>Avisaremos por e-mail e dentro do app quando esta política mudar de forma relevante.</p>
    </LegalPage>
  );
}
