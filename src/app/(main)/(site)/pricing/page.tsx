import type { Metadata } from "next";
import { CheckList, InfoHero } from "@/components/info-page";
import { Card, LinkButton } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { federationPlanPriceCents, platformFeePerAthleteCents } from "@/server/billing-config";
import { PLAN_FEATURES, PLAN_LABEL } from "@/lib/federation-rules";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = { title: "Preços — Camps" };

export default function PricingPage() {
  const fee = formatMoney(platformFeePerAthleteCents(), "AOA");
  return (
    <>
      <InfoHero
        eyebrow="Preços"
        title="Simples para quem compete, justo para quem organiza"
        lead="Acompanhar torneios e criar conta não custa nada. O atleta paga apenas a inscrição definida pelo organizador do evento."
        image="/images/pavilhao.jpg"
        imageAlt="Pavilhão durante um torneio de artes marciais, com várias áreas de competição e mesas de organização"
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
            <p className="text-sm font-semibold uppercase tracking-wider text-muted">Organizadores</p>
            <p className="mt-3 font-display text-6xl font-bold uppercase leading-none">{fee}</p>
            <p className="mt-1 text-sm font-semibold">por atleta confirmado, por evento</p>
            <p className="mt-2 text-sm text-muted">
              Sem mensalidade nem custos de arranque. Cada atleta conta uma vez por evento, seja em quantas categorias
              for. As inscrições pagas online são transferidas para a sua conta depois do evento, já sem a taxa.
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

      <section className="mt-14">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Federações e ligas</p>
        <h2 className="mt-2 font-display text-4xl font-bold uppercase leading-none">Plano Federação</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Uma página própria para a federação, com os eventos das organizações associadas, filiação de academias e
          atletas e ranking nacional. Assinatura anual; as quotas de filiação vão inteiras para a federação.
        </p>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {(["BASIC", "PREMIUM"] as const).map((plan) => (
            <Reveal key={plan} stagger className="h-full">
              <Card className={`flex h-full flex-col p-7 ${plan === "PREMIUM" ? "border-primary/40" : ""}`}>
                <p className="text-sm font-semibold uppercase tracking-wider text-muted">{PLAN_LABEL[plan]}</p>
                <p className="mt-3 font-display text-5xl font-bold uppercase leading-none">
                  {formatMoney(federationPlanPriceCents(plan), "AOA")}
                </p>
                <p className="mt-1 text-sm font-semibold">por ano</p>
                <div className="mt-6">
                  <CheckList items={PLAN_FEATURES[plan]} />
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
        <LinkButton href="/manage" variant="secondary" className="mt-6">
          Criar a página da federação
        </LinkButton>
      </section>

      <p className="mt-8 text-sm text-muted">
        Os pagamentos de inscrições são processados por Multicaixa Express ou PayPal. Os atletas pagam apenas o preço da
        inscrição; a taxa da Camps é paga pelo organizador.
      </p>
    </>
  );
}
