import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Termos de utilização — Camps" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Termos de utilização"
      intro={`Estes termos regulam o uso da Camps, plataforma de gestão de torneios de desportos de combate explorada por ${LEGAL.company}, NIF ${LEGAL.nif}, com sede em ${LEGAL.address}. Ao criar uma conta ou usar a plataforma, aceita estes termos.`}
    >
      <LegalSection n={1} title="O que a Camps faz">
        <p>
          A Camps põe em contacto <strong>organizadores</strong> de eventos e <strong>federações</strong> com{" "}
          <strong>atletas</strong>, treinadores e público. Permite criar eventos, receber inscrições e pagamentos, gerar
          chaves, controlar o placar, transmitir e publicar resultados, e gerir filiações de federações.
        </p>
        <p>
          Cada evento é da responsabilidade do seu organizador, e cada filiação da respetiva federação. A Camps não
          organiza os eventos nem é parte nos acordos entre atletas, organizadores e federações.
        </p>
      </LegalSection>

      <LegalSection n={2} title="Conta">
        <ul>
          <li>Tem de dar dados verdadeiros e manter o e-mail atualizado: é para lá que vão os comprovativos e os avisos.</li>
          <li>A palavra-passe é pessoal. É responsável pelo que for feito com a sua conta.</li>
          <li>
            Pode inscrever outras pessoas (por exemplo, filhos menores) se tiver autorização para isso. Quem inscreve um
            menor declara ser o seu representante legal ou ter autorização dele.
          </li>
          <li>Podemos suspender contas usadas para fraude, abuso ou em violação destes termos.</li>
        </ul>
      </LegalSection>

      <LegalSection n={3} title="Inscrições e pagamentos">
        <ul>
          <li>
            Os preços, as categorias, as regras e as datas de cada evento são definidos pelo organizador e aparecem na
            página do evento antes do pagamento.
          </li>
          <li>
            Os pagamentos são processados por Multicaixa Express (através da ProxyPay) ou PayPal. A Camps não guarda dados
            de cartões nem códigos de acesso bancário.
          </li>
          <li>Uma inscrição só fica confirmada quando o pagamento é aceite pelo provedor.</li>
          <li>
            No PayPal, o valor é cobrado noutra moeda ao câmbio indicado antes do pagamento; o seu banco pode aplicar
            comissões próprias.
          </li>
        </ul>
      </LegalSection>

      <LegalSection n={4} title="Cancelamentos e reembolsos">
        <p>
          Cada organizador (ou federação, nas quotas) define a sua política de reembolsos e é quem decide e pede cada
          reembolso. Os reembolsos feitos pela plataforma são sempre do valor total e voltam para a conta de onde saiu o
          pagamento. Se o evento for cancelado, deve contactar o organizador.
        </p>
      </LegalSection>

      <LegalSection n={5} title="Organizadores e federações">
        <ul>
          <li>
            Pagam à Camps uma taxa por atleta confirmado em cada evento, ou a assinatura do Plano Federação, conforme a
            página de <Link href="/pricing" className="font-semibold text-primary hover:underline">Preços</Link>.
          </li>
          <li>
            Os valores recebidos são repassados para o IBAN indicado, descontada a taxa da Camps. As quotas de filiação
            passam inteiras para a federação.
          </li>
          <li>
            São responsáveis pela informação que publicam, pelo cumprimento das regras do evento, pela segurança dos
            atletas e pelas licenças e seguros que a lei exija.
          </li>
          <li>Só podem usar os dados dos atletas para gerir o evento ou a filiação.</li>
        </ul>
      </LegalSection>

      <LegalSection n={6} title="Conteúdo público">
        <p>
          Para que os torneios possam ser acompanhados, o nome do atleta, a academia, a categoria, as chaves, os
          resultados e os rankings são públicos. As transmissões são da responsabilidade de quem as faz e das plataformas
          onde são alojadas (YouTube, Facebook).
        </p>
      </LegalSection>

      <LegalSection n={7} title="Uso aceitável">
        <p>Não é permitido usar a Camps para fraude, para publicar conteúdo ilegal ou ofensivo, para recolher dados de outros utilizadores ou para tentar comprometer a segurança da plataforma.</p>
      </LegalSection>

      <LegalSection n={8} title="Responsabilidade">
        <p>
          Fazemos o possível para que a Camps esteja sempre disponível e sem erros, mas não o podemos garantir. Na medida
          permitida por lei, não respondemos por prejuízos indiretos nem por atos de organizadores, federações, atletas ou
          provedores de pagamento.
        </p>
      </LegalSection>

      <LegalSection n={9} title="Dados pessoais">
        <p>
          O tratamento dos seus dados está descrito na{" "}
          <Link href="/privacy" className="font-semibold text-primary hover:underline">
            Política de privacidade
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection n={10} title="Alterações e lei aplicável">
        <p>
          Podemos alterar estes termos; as alterações importantes são avisadas por e-mail ou na plataforma. Estes termos
          regem-se pela lei da República de Angola. Os litígios são resolvidos nos tribunais de Luanda, sem prejuízo dos
          direitos dos consumidores.
        </p>
        <p>Contacto: {LEGAL.contactEmail}</p>
      </LegalSection>
    </LegalPage>
  );
}
