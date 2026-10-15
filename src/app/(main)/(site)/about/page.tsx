import type { Metadata } from "next";
import { CheckList, InfoCard, InfoHero } from "@/components/info-page";
import { LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "Sobre nós — Camps" };

export default function AboutPage() {
  return (
    <>
      <InfoHero
        eyebrow="Sobre nós"
        title="Tecnologia ao serviço dos desportos de combate"
        lead="A Camps é um sistema de gestão de competições, feito para os torneios de Angola: do primeiro inscrito ao último pódio."
        image="/hero/torneio.jpg"
        imageAlt="Pavilhão com várias áreas de luta durante um torneio"
      />

      <div className="grid gap-5 md:grid-cols-3">
        <InfoCard title="O problema">
          <p>
            Muitos torneios ainda se organizam com folhas de cálculo, listas em grupos de mensagens e chaves desenhadas
            à mão. Isso gera erros, atrasos no dia do evento e resultados que nunca chegam a quem competiu.
          </p>
        </InfoCard>
        <InfoCard title="A nossa resposta">
          <p>
            Uma só plataforma onde o organizador cria o evento, recebe inscrições e pagamentos, gera as chaves, controla o
            placar e publica os resultados, e onde atletas e famílias acompanham tudo.
          </p>
        </InfoCard>
        <InfoCard title="Feita para Angola">
          <p>
            Preços em kwanzas, pagamento por Multicaixa Express, fuso de Luanda e textos em português. Funciona no
            telemóvel, que é onde a maioria das pessoas acompanha os torneios.
          </p>
        </InfoCard>
      </div>

      <section className="mt-12 grid items-start gap-8 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-4xl font-bold uppercase leading-none">O que a Camps faz</h2>
          <p className="mt-3 text-muted">
            Tudo o que um torneio de desportos de combate precisa, numa sequência em que cada passo alimenta o seguinte.
          </p>
        </div>
        <CheckList
          items={[
            "Eventos com categorias por sexo, idade, faixa e peso",
            "Inscrições online com pagamento por Multicaixa Express ou PayPal",
            "Chaves automáticas com cabeças de chave, byes e academias separadas",
            "Placar digital por área de luta, com ecrã de TV",
            "Transmissão em direto na página do evento",
            "Resultados, pódios e histórico de atletas e academias",
          ]}
        />
      </section>

      <div className="mt-12 flex flex-wrap gap-3">
        <LinkButton href="/manage">Organizar um torneio</LinkButton>
        <LinkButton href="/events" variant="secondary">
          Ver torneios
        </LinkButton>
      </div>
    </>
  );
}
