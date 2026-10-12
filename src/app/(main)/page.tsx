import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { EventCard } from "@/components/event-card";
import { HeroSlideshow, type Slide } from "@/components/hero-slideshow";
import {
  BracketMock,
  MiniBracketMock,
  PanelMock,
  PaymentMock,
  PodiumMock,
  ScoreboardMock,
} from "@/components/landing-mocks";
import { Reveal } from "@/components/reveal";
import { Icon, LinkButton } from "@/components/ui";
import { listPublishedEvents } from "@/server/events";

// Fotografias de uso livre (ver créditos no README). Trocar pelas dos próprios eventos em public/hero/.
const SLIDES: Slide[] = [
  { src: "/hero/torneio.jpg", alt: "Pavilhão com várias áreas de luta durante um torneio de jiu-jitsu" },
  { src: "/hero/luta.jpg", alt: "Dois atletas de quimono a lutar sobre o tatami" },
  { src: "/hero/finalizacao.jpg", alt: "Atleta a controlar o adversário no chão" },
];

const SPORTS = ["Jiu-Jitsu", "Judo", "Grappling", "Karaté", "Kickboxing", "Taekwondo", "Luta", "Boxe", "MMA"];

const BRACKET_FEATURES = [
  { title: "Eliminação simples", text: "Quem perde sai; quem vence avança sozinho na chave." },
  { title: "Disputa de 3.º lugar", text: "Os perdedores das semifinais lutam pelo bronze." },
  { title: "Todos contra todos", text: "Para categorias pequenas: cada atleta enfrenta os outros." },
  { title: "Cabeças de chave", text: "Os favoritos só se cruzam nas rondas finais." },
  { title: "Byes automáticos", text: "Número ímpar de atletas? Os melhores avançam direto." },
  { title: "Academias separadas", text: "Colegas de equipa ficam em lados opostos da chave." },
];

const STEPS = [
  { title: "Crie o evento", text: "Nome, data, local e prazo das inscrições. Nasce como rascunho." },
  { title: "Abra as categorias", text: "Sexo, idade, faixa, peso e preço de cada uma." },
  { title: "Receba inscrições", text: "Os atletas inscrevem-se e pagam; a lista atualiza sozinha." },
  { title: "Gere a chave e lance resultados", text: "Um clique por luta. O pódio fecha no fim." },
];

const PACKAGE = [
  {
    title: "Inscrições e pagamentos",
    items: [
      "Inscrição online pelo atleta ou pelo treinador",
      "Uma conta gere vários atletas",
      "Multicaixa Express e PayPal",
      "Categorias gratuitas ou pagas, em kwanzas",
      "Inscrição manual pelo organizador",
    ],
  },
  {
    title: "Chaves",
    items: [
      "Geração automática a partir dos inscritos pagos",
      "Eliminação simples e todos contra todos",
      "Cabeças de chave e byes",
      "Separação de atletas da mesma academia",
    ],
  },
  {
    title: "Resultados",
    items: [
      "Lançamento de resultados luta a luta",
      "A chave avança sozinha",
      "Pódio calculado no fim da categoria",
      "Página pública por evento e por categoria",
    ],
  },
  {
    title: "Placar e transmissão",
    items: [
      "Placar digital com cronómetro por luta",
      "Ecrã de TV e sobreposição por área de luta",
      "Transmissão em direto na página do evento",
      "Resultado gravado na chave ao terminar a luta",
    ],
  },
  {
    title: "Organização",
    items: [
      "Painel com eventos, categorias e inscritos",
      "Várias organizações por conta",
      "Rascunho e publicação do evento",
      "Limite de idade e de peso por categoria",
    ],
  },
];

const LIVE_POINTS = [
  "Pontos, vantagens, punições e cronómetro num só ecrã de controlo",
  "Ecrã de TV por área de luta, atualizado ao segundo",
  "Transmissão pelo YouTube ou Facebook, embutida na página do evento",
  "Placar sobreposto ao vídeo, para o programa de transmissão",
];

const ROADMAP = [
  "Pesagem e check-in",
  "Programação por áreas de luta",
  "Cupões e reembolsos",
  "Dupla eliminação e equipas",
  "Ranking e federações",
];

const PAYMENT_POINTS = [
  "Multicaixa Express: o pedido chega ao telemóvel do atleta",
  "PayPal para quem se inscreve de fora do país",
  "Preços em kwanzas e inscrição confirmada assim que o pagamento entra",
];

function Section({ children, id, className = "" }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <section id={id} className={`mx-auto w-full max-w-6xl scroll-mt-20 px-4 ${className}`}>
      {children}
    </section>
  );
}

function Heading({ children, muted }: { children: ReactNode; muted?: ReactNode }) {
  return (
    <Reveal>
      <h2 className="font-display text-4xl font-bold uppercase leading-[0.95] tracking-tight sm:text-5xl">
        {children}
        {muted && <span className="text-muted"> {muted}</span>}
      </h2>
    </Reveal>
  );
}

function FeatureCard({ title, muted, children }: { title: string; muted: string; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col justify-between gap-8 overflow-hidden rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-foreground/30">
      <p className="text-lg font-semibold leading-snug">
        {title} <span className="text-muted">{muted}</span>
      </p>
      {children}
    </div>
  );
}

async function UpcomingEvents() {
  const events = await listPublishedEvents(4);
  if (events.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line px-6 py-10 text-center text-sm text-muted">
        Ainda não há eventos publicados. O seu pode ser o primeiro.
      </p>
    );
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {events.map((event) => (
        <li key={event.id} className="min-w-0">
          <EventCard event={event} />
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <div className="dark-scope overflow-x-clip">
      {/* Abertura: slideshow de fundo e texto por cima */}
      <div className="relative isolate flex min-h-[calc(100svh-3.5rem)] items-center overflow-hidden bg-ink">
        <HeroSlideshow slides={SLIDES} />
        <div className="hero-shade absolute inset-0" aria-hidden="true" />
        <Section className="relative z-10 py-24">
          <p className="hero-enter text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Software de torneios para desportos de combate
          </p>
          <h1
            className="hero-enter mt-4 max-w-3xl font-display text-6xl font-bold uppercase leading-[0.9] tracking-tight text-white sm:text-8xl"
            style={{ animationDelay: "120ms" }}
          >
            Do primeiro inscrito ao último pódio
          </h1>
          <p className="hero-enter mt-6 max-w-xl text-lg text-white/80" style={{ animationDelay: "240ms" }}>
            A Camps junta inscrições, pagamentos, chaves e resultados num só lugar. Feita para os torneios de Angola.
          </p>
          <div className="hero-enter mt-8 flex flex-wrap gap-3" style={{ animationDelay: "360ms" }}>
            <LinkButton href="/events" className="h-12 px-6 text-base">
              Encontrar eventos
            </LinkButton>
            <LinkButton href="/manage" variant="inverse" className="h-12 px-6 text-base">
              Criar evento
            </LinkButton>
          </div>
        </Section>
      </div>

      {/* Desportos */}
      <Section className="py-20 text-center">
        <Reveal>
          <p className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl">
            <span className="text-accent">Um tatami,</span> todos os desportos de combate
          </p>
        </Reveal>
        <ul className="mt-8 flex flex-wrap justify-center gap-3">
          {SPORTS.map((sport, index) => (
            <li key={sport}>
              <Reveal delay={index * 50}>
                <span className="block rounded-full border border-line bg-surface px-5 py-2 text-sm font-medium">
                  {sport}
                </span>
              </Reveal>
            </li>
          ))}
        </ul>
      </Section>

      {/* Quatro pilares */}
      <Section id="funcionalidades" className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-4">
        <Reveal className="h-full">
          <FeatureCard title="Chaves que se montam sozinhas." muted="Byes, cabeças de chave e academias separadas.">
            <MiniBracketMock />
          </FeatureCard>
        </Reveal>
        <Reveal delay={100} className="h-full">
          <FeatureCard title="Inscrições e pagamentos" muted="em kwanzas, por Multicaixa Express ou PayPal.">
            <PaymentMock />
          </FeatureCard>
        </Reveal>
        <Reveal delay={200} className="h-full">
          <FeatureCard title="Resultados à vista de todos." muted="Chave e pódio públicos, atualizados a cada luta.">
            <PodiumMock />
          </FeatureCard>
        </Reveal>
        <Reveal delay={300} className="h-full">
          <FeatureCard
            title="Um painel para o organizador."
            muted="Eventos, categorias e inscritos sem folhas de cálculo."
          >
            <PanelMock />
          </FeatureCard>
        </Reveal>
      </Section>

      {/* Eventos reais */}
      <Section className="pb-24">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <Heading>Próximos eventos</Heading>
          <Link href="/events" className="flex items-center gap-1 text-sm font-semibold hover:text-primary">
            Ver todos
            <Icon name="chevron-right" />
          </Link>
        </div>
        <Reveal delay={100}>
          <Suspense fallback={<p className="text-sm text-muted">A carregar eventos…</p>}>
            <UpcomingEvents />
          </Suspense>
        </Reveal>
      </Section>

      {/* Chaves */}
      <Section className="pb-24">
        <Heading muted="A chave aguenta.">Torneio grande?</Heading>
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_auto]">
          <div className="grid gap-3">
            <ul className="grid gap-3 sm:grid-cols-2">
              {BRACKET_FEATURES.map((feature, index) => (
                <li key={feature.title}>
                  <Reveal delay={(index % 2) * 100} className="h-full">
                    <div className="h-full rounded-xl border border-line bg-surface p-5">
                      <p className="font-semibold">{feature.title}</p>
                      <p className="mt-2 text-sm text-muted">{feature.text}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ul>
            <Reveal>
              <div className="rounded-xl border border-line bg-surface-2 p-6">
                <p className="font-display text-3xl font-bold uppercase leading-none">
                  Sem folhas de cálculo. <span className="text-muted">Sem sorteios à mão.</span>
                </p>
                <p className="mt-3 text-sm text-muted">
                  A chave é gerada a partir dos atletas com inscrição paga e avança sozinha a cada resultado lançado.
                </p>
              </div>
            </Reveal>
          </div>
          <Reveal delay={150} className="hidden lg:block">
            <div className="-rotate-2 rounded-2xl border border-line bg-surface-2 p-6">
              <BracketMock />
            </div>
          </Reveal>
        </div>
      </Section>

      {/* Placar e transmissão */}
      <Section id="placar" className="pb-24">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <ScoreboardMock />
          </Reveal>
          <div>
            <Heading muted="Em direto para quem não pôde ir.">O placar no tatami.</Heading>
            <ul className="mt-6 space-y-3">
              {LIVE_POINTS.map((item, index) => (
                <li key={item}>
                  <Reveal delay={index * 80} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                      <Icon name="check" className="h-3.5 w-3.5" />
                    </span>
                    {item}
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* Pagamentos */}
      <Section id="pagamentos" className="pb-24">
        <Reveal>
          <div className="grid items-center gap-10 rounded-2xl bg-accent px-6 py-12 text-ink sm:px-12 lg:grid-cols-[1fr_auto]">
            <div>
              <h2 className="font-display text-4xl font-bold uppercase leading-[0.95] tracking-tight sm:text-5xl">
                Pagar como se paga em Angola
              </h2>
              <ul className="mt-6 space-y-3 text-base font-medium">
                {PAYMENT_POINTS.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-accent">
                      <Icon name="check" className="h-3.5 w-3.5" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="dark-scope rounded-[2rem] bg-transparent">
              <PaymentMock />
            </div>
          </div>
        </Reveal>
      </Section>

      {/* Como funciona */}
      <Section id="como-funciona" className="pb-24">
        <Heading muted="em quatro passos.">Organize o seu torneio</Heading>
        <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <Reveal delay={index * 100} className="h-full">
                <div className="h-full rounded-xl border border-line bg-surface p-6">
                  <span className="font-display text-5xl font-bold leading-none text-primary">{index + 1}</span>
                  <p className="mt-4 font-semibold">{step.title}</p>
                  <p className="mt-2 text-sm text-muted">{step.text}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </Section>

      {/* Tudo num só pacote */}
      <Section className="pb-24">
        <Heading>Tudo num só pacote</Heading>
        <div className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-2">
          {PACKAGE.map((group, index) => (
            <Reveal key={group.title} delay={(index % 2) * 100}>
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">{group.title}</p>
              <ul className="space-y-3 rounded-xl border border-line bg-surface p-6">
                {group.items.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm">
                    <Icon name="check" className="mt-0.5 h-4 w-4 text-success" />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
          <Reveal delay={100}>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              A caminho · ainda não disponível
            </p>
            <ul className="flex flex-wrap gap-2 rounded-xl border border-dashed border-line p-6">
              {ROADMAP.map((item) => (
                <li key={item} className="rounded-full bg-foreground/8 px-4 py-1.5 text-sm text-muted">
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Section>

      {/* Chamada final */}
      <Section className="pb-24">
        <Reveal>
          <div className="rounded-2xl bg-primary px-6 py-16 text-center text-white sm:py-20">
            <h2 className="font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl">
              Crie o seu primeiro evento hoje
            </h2>
            <p className="mx-auto mt-4 max-w-md text-white/85">
              Abrir uma organização e publicar um evento leva poucos minutos.
            </p>
            <Link
              href="/manage"
              className="mt-8 inline-flex h-12 items-center justify-center rounded-lg bg-white px-8 text-base font-semibold text-primary transition-colors hover:bg-white/90"
            >
              Começar
            </Link>
          </div>
        </Reveal>
      </Section>
    </div>
  );
}
