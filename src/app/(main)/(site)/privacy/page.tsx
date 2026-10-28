import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Política de privacidade — Camps" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Política de privacidade"
      intro={`Esta política explica que dados pessoais a Camps trata, para quê e com que direitos, nos termos da Lei n.º 22/11, de 17 de junho (Lei da Protecção de Dados Pessoais). O responsável pelo tratamento é ${LEGAL.company}, NIF ${LEGAL.nif}, ${LEGAL.address}.`}
    >
      <LegalSection n={1} title="Que dados tratamos">
        <ul>
          <li>
            <strong>Conta:</strong> nome, e-mail, palavra-passe (guardada só como resumo cifrado, nunca em claro).
          </li>
          <li>
            <strong>Atletas:</strong> nome, data de nascimento, sexo, academia, faixa, peso e resultados.
          </li>
          <li>
            <strong>Pagamentos:</strong> número de telemóvel do Multicaixa Express, valores, estado e referências das
            transações. Não recebemos dados de cartões nem códigos bancários.
          </li>
          <li>
            <strong>Organizadores e federações:</strong> credenciais da conta de pagamentos (ProxyPay e PayPal), guardadas cifradas, e os dados de faturação.
          </li>
          <li>
            <strong>Dados técnicos:</strong> endereço IP, sessão (cookie) e registos de erros, por segurança.
          </li>
        </ul>
      </LegalSection>

      <LegalSection n={2} title="Para que os usamos">
        <ul>
          <li>Executar o serviço que pediu: inscrições, pagamentos, chaves, resultados, filiações e compra de créditos.</li>
          <li>Enviar e-mails de serviço: confirmação do e-mail, palavra-passe, comprovativos e reembolsos.</li>
          <li>Proteger a plataforma contra fraude e abuso, e cumprir obrigações legais e fiscais.</li>
        </ul>
        <p>Não vendemos dados pessoais nem os usamos para publicidade de terceiros.</p>
      </LegalSection>

      <LegalSection n={3} title="O que é público">
        <p>
          Nome do atleta, academia, categoria, chaves, resultados, medalhas e rankings ficam visíveis a qualquer pessoa,
          porque é para isso que um torneio existe. A data de nascimento, o e-mail, o telemóvel e o IBAN nunca são
          públicos.
        </p>
      </LegalSection>

      <LegalSection n={4} title="Com quem partilhamos">
        <ul>
          <li>O organizador do evento ou a federação em que se inscreve ou se filia, para gerir a prova ou a filiação.</li>
          <li>ProxyPay e PayPal, para processar pagamentos e reembolsos.</li>
          <li>Resend, para enviar e-mails.</li>
          <li>O fornecedor de alojamento e o serviço de registo de erros da plataforma.</li>
        </ul>
        <p>
          Alguns destes prestadores estão fora de Angola. Essas transferências fazem-se só na medida necessária ao serviço,
          com as garantias e autorizações exigidas pela Agência de Protecção de Dados.
        </p>
      </LegalSection>

      <LegalSection n={5} title="Menores">
        <p>
          Atletas menores são inscritos por um adulto responsável, que declara ter autorização do representante legal.
          Os dados de menores são usados apenas para a participação nos eventos.
        </p>
      </LegalSection>

      <LegalSection n={6} title="Durante quanto tempo">
        <p>
          Os dados da conta ficam enquanto a conta existir. Os registos de pagamentos são guardados pelo prazo exigido pela
          lei fiscal. Os resultados desportivos fazem parte do histórico dos eventos e dos rankings. Os links de acesso
          enviados por e-mail expiram e não ficam guardados.
        </p>
      </LegalSection>

      <LegalSection n={7} title="Os seus direitos">
        <p>
          Em <strong>A minha conta</strong> pode corrigir o nome e o e-mail, descarregar uma cópia dos seus dados e
          eliminar a conta. Para outros pedidos (acesso, correção dos dados de atletas, oposição a um tratamento),
          escreva para <strong>{LEGAL.contactEmail}</strong>. Respondemos no prazo legal. Pode também apresentar queixa à
          Agência de Protecção de Dados (APD).
        </p>
      </LegalSection>

      <LegalSection n={8} title="Segurança e cookies">
        <p>
          Usamos ligações cifradas (https), palavras-passe guardadas com resumo criptográfico, limites de tentativas e
          acessos restritos. A Camps usa apenas um cookie de sessão, necessário para manter a conta aberta; não usa cookies
          de publicidade nem de análise.
        </p>
      </LegalSection>

      <LegalSection n={9} title="Alterações">
        <p>Se esta política mudar de forma importante, avisamos por e-mail ou na plataforma.</p>
      </LegalSection>
    </LegalPage>
  );
}
