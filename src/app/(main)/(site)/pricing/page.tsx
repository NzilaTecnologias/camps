import type { Metadata } from "next";
import { CheckList, InfoHero } from "@/components/info-page";
import { Badge, Card, LinkButton } from "@/components/ui";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = { title: "Preços — Camps" };

export default function PricingPage() {
  return (
    <>
      <InfoHero
        eyebrow="Preços"
        title="Simples para quem compete, justo para quem organiza"
        lead="Acompanhar torneios e criar conta não custa nada. O atleta paga apenas a inscrição definida pelo organizador do evento."
        image="/images/podio.jpg"
        imageAlt="Atletas no pódio de um torneio, com troféus"
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Reveal stagger className="h-full">
          <Card className="flex flex-col p-7">
            <p className="text-sm font-semibold uppercase tracking-wider text-muted">Atletas, treinadores e público</p>
            <p className="mt-3 font-display text-6xl font-bold uppercase leading-none">Grátis</p>
            <p className="mt-2 text-sm text-muted">
              Sem mensalidades. A única coisa paga é a inscrição em cada torneio, ao preço que o organizador definir.
            </p>
            <div className="mt-6">
              <CheckList
                items={[
                  "Criar conta e gerir vários atletas",
                  "Procurar torneios e inscrever-se online",
                  "Ver chaves, resultados e pódios",
                  "Acompanhar as lutas e as transmissões em direto",
                ]}
              />
            </div>
            <LinkButton href="/events" variant="secondary" className="mt-8 self-start">
              Encontrar torneios
            </LinkButton>
          </Card>
        </Reveal>

        <Reveal stagger className="h-full">
          <Card className="flex flex-col border-primary/40 p-7">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold uppercase tracking-wider text-muted">Organizadores</p>
              <Badge tone="primary">Em breve</Badge>
            </div>
            <p className="mt-3 font-display text-6xl font-bold uppercase leading-none">A anunciar</p>
            <p className="mt-2 text-sm text-muted">
              Os planos para ligas, federações e academias que organizam torneios ainda não foram publicados.
            </p>
            <div className="mt-6">
              <CheckList
                items={[
                  "Eventos, categorias e áreas de luta",
                  "Inscrições e pagamentos em kwanzas",
                  "Chaves automáticas e lançamento de resultados",
                  "Placar digital, ecrã de TV e transmissão",
                ]}
              />
            </div>
            <LinkButton href="/manage" className="mt-8 self-start">
              Criar conta de organizador
            </LinkButton>
          </Card>
        </Reveal>
      </div>

      <p className="mt-8 text-sm text-muted">
        Os pagamentos de inscrições são processados por Multicaixa Express ou PayPal. As taxas desses serviços podem
        aplicar-se.
      </p>
    </>
  );
}
