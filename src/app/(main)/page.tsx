import { connection } from "next/server";
import Image from "next/image";
import { ParallaxImage } from "@/components/parallax-image";
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

// Fotografias de uso livre (créditos no README). Trocar pelas dos próprios eventos em public/hero e public/images.
const SLIDES: Slide[] = [
  { src: "/hero/luta.jpg", alt: "Dois atletas de quimono a lutar sobre o tatami" },
  { src: "/images/karate-combate.jpg", alt: "Combate de karaté com o placar eletrónico ao fundo" },
  { src: "/images/taekwondo.jpg", alt: "Combate de taekwondo com público a assistir" },
  { src: "/hero/finalizacao.jpg", alt: "Atleta a controlar o adversário no chão" },
];

/** O que o sistema faz, pela ordem em que acontece num torneio. */
const FLOW = [
  { icon: "flag", title: "Criar o torneio", text: "Evento, datas, local, áreas de luta e categorias por sexo, idade, faixa e peso." },
  { icon: "wallet", title: "Inscrições e pagamentos", text: "Os atletas inscrevem-se online e pagam por Multicaixa Express ou PayPal." },
  { icon: "bracket", title: "Chaves automáticas", text: "As chaves são geradas a partir dos inscritos pagos, com cabeças de chave e byes." },
  { icon: "monitor", title: "Placar e direto", text: "Placar digital por área, ecrã de TV e transmissão na página do evento." },
  { icon: "trophy", title: "Resultados e pódio", text: "Cada luta avança a chave sozinha; o pódio fica publicado no fim." },
] as const;

const MODULES = ["Inscrições", "Pagamentos", "Chaves", "Placar", "Transmissão", "Resultados"];

const AUDIENCES = [
  {
    image: "/hero/torneio.jpg",
    alt: "Pavilhão com várias áreas de luta durante um torneio",
    title: "Organizadores",
    lead: "Ligas, federações e academias que promovem torneios.",
    points: ["Evento e categorias em minutos", "Inscritos e pagamentos num só painel", "Chaves, placar e resultados sem papel"],
    href: "/manage",
    cta: "Organizar um torneio",
  },
  {
    image: "/images/atleta.jpg",
    alt: "Atleta de quimono azul a sorrir para a câmara",
    title: "Atletas e treinadores",
    lead: "Quem compete e quem inscreve a equipa.",
    points: ["Encontrar torneios e inscrever-se online", "Uma conta para inscrever vários atletas", "Ver a chave e saber quando luta"],
    href: "/events",
    cta: "Encontrar torneios",
  },
  {
    image: "/images/torneio-infantil.jpg",
    alt: "Crianças a competir num torneio, com pais e treinadores a assistir",
    title: "Público e famílias",
    lead: "Quem acompanha das bancadas ou de casa.",
    points: ["Chaves e pódios públicos, sem conta", "Lutas a decorrer com o placar ao vivo", "Transmissão em direto do evento"],
    href: "/events",
    cta: "Ver eventos",
  },
];

const SPORT_TILES = [
  { name: "Jiu-Jitsu", image: "/images/jiu-jitsu.jpg", alt: "Atletas de jiu-jitsu de quimono sobre tatami vermelho" },
  { name: "Karaté", image: "/images/karate-combate.jpg", alt: "Duas atletas de karaté em combate" },
  { name: "Taekwondo", image: "/images/taekwondo.jpg", alt: "Pontapé num combate de taekwondo" },
  { name: "Grappling", image: "/images/grappling.jpg", alt: "Atletas de grappling sem quimono a lutar no chão" },
];

const OTHER_SPORTS = ["Judo", "Kickboxing", "Luta", "Boxe", "MMA", "Sambo"];

const BRACKET_FEATURES = [
  { title: "Eliminação simples", text: "Quem perde sai; quem vence avança sozinho na chave." },
  { title: "Disputa de 3.º lugar", text: "Os perdedores das semifinais lutam pelo bronze." },
  { title: "Todos contra todos", text: "Para categorias pequenas: cada atleta enfrenta os outros." },
  { title: "Cabeças de chave", text: "Os favoritos só se cruzam nas rondas finais." },
  { title: "Byes automáticos", text: "Número ímpar de atletas? Os melhores avançam direto." },
  { title: "Academias separadas", text: "Colegas de equipa ficam em lados opostos da chave." },
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

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">{children}</p>;
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
  // Os dados vêm de cache, mas "inscrições abertas", "faltam N dias" e o ano das datas dependem
  // da hora deste pedido: a parte da página com eles é sempre calculada no momento.
  await connection();

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
      {/* Abertura: diz logo que é um sistema de gestão de torneios */}
      <div className="relative isolate flex min-h-[calc(100svh-3.5rem)] items-center overflow-hidden bg-ink">
        <HeroSlideshow slides={SLIDES} />
        <div className="hero-shade absolute inset-0" aria-hidden="true" />
        <Section className="relative z-10 py-24">
          <p className="hero-enter inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-accent backdrop-blur">
            <Icon name="trophy" className="h-4 w-4" />
            Sistema de gestão de competições
          </p>
          <h1
            className="hero-enter mt-5 max-w-4xl font-display text-6xl font-bold uppercase leading-[0.9] tracking-tight text-white sm:text-8xl"
            style={{ animationDelay: "120ms" }}
          >
            Gestão de torneios de desportos de combate
          </h1>
          <p className="hero-enter mt-6 max-w-2xl text-lg text-white/85 sm:text-xl" style={{ animationDelay: "240ms" }}>
            A Camps organiza o torneio do início ao fim: inscrições e pagamentos online, chaves automáticas, placar
            digital, transmissão em direto e resultados. Tudo numa só plataforma, feita para Angola.
          </p>
          <div className="hero-enter mt-8 flex flex-wrap gap-3" style={{ animationDelay: "360ms" }}>
            <LinkButton href="/manage" className="h-12 px-6 text-base">
              Organizar um torneio
            </LinkButton>
            <LinkButton href="/events" variant="inverse" className="h-12 px-6 text-base">
              Encontrar torneios
            </LinkButton>
          </div>
          <ul
            className="hero-enter mt-10 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-white/75"
            style={{ animationDelay: "480ms" }}
            aria-label="O que a plataforma inclui"
          >
            {MODULES.map((module) => (
              <li key={module} className="flex items-center gap-1.5">
                <Icon name="check" className="h-4 w-4 text-accent" />
                {module}
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {/* O que é: o percurso de um torneio na plataforma */}
      <Section id="como-funciona" className="py-24">
        <div className="max-w-3xl">
          <Reveal>
            <Eyebrow>O que é a Camps</Eyebrow>
          </Reveal>
          <Heading muted="da primeira inscrição ao último pódio.">Um sistema para gerir a competição inteira,</Heading>
          <Reveal delay={100}>
            <p className="mt-5 text-lg text-muted">
              Em vez de folhas de cálculo, listas no WhatsApp e chaves desenhadas à mão, o torneio passa todo pela
              Camps. Cada passo alimenta o seguinte.
            </p>
          </Reveal>
        </div>

        <ol className="relative mt-12 grid gap-4 md:grid-cols-5">
          {/* Linha que liga os passos em ecrãs largos */}
          <span aria-hidden="true" className="absolute top-7 right-[10%] left-[10%] hidden h-px bg-line md:block" />
          {FLOW.map((step, index) => (
            <li key={step.title} className="relative">
              <Reveal delay={index * 90} className="h-full">
                <div className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5">
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
                      <Icon name={step.icon} className="h-7 w-7" />
                    </span>
                    <span className="font-display text-4xl font-bold leading-none text-foreground/15">{index + 1}</span>
                  </div>
                  <p className="mt-4 font-semibold">{step.title}</p>
                  <p className="mt-2 text-sm text-muted">{step.text}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </Section>

      {/* Para quem é */}
      <Section id="para-quem" className="pb-24">
        <Reveal>
          <Eyebrow>Para quem é</Eyebrow>
        </Reveal>
        <Heading muted="Cada um com a sua parte.">Organizadores, atletas e público.</Heading>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {AUDIENCES.map((audience, index) => (
            <Reveal key={audience.title} delay={index * 100} className="h-full">
              <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={audience.image}
                    alt={audience.alt}
                    fill
                    sizes="(min-width: 1024px) 33vw, 100vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="font-display text-3xl font-bold uppercase leading-none">{audience.title}</h3>
                  <p className="mt-2 text-sm text-muted">{audience.lead}</p>
                  <ul className="mt-5 space-y-2.5">
                    {audience.points.map((point) => (
                      <li key={point} className="flex items-start gap-2.5 text-sm">
                        <Icon name="check" className="mt-0.5 h-4 w-4 text-success" />
                        {point}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={audience.href}
                    className="mt-auto flex items-center gap-1 pt-6 text-sm font-semibold text-primary hover:underline"
                  >
                    {audience.cta}
                    <Icon name="chevron-right" />
                  </Link>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Desportos, com fotografias */}
      <Section className="pb-24">
        <Heading muted="Um sistema, vários desportos.">Para qualquer desporto de combate.</Heading>
        <ul className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {SPORT_TILES.map((sport, index) => (
            <li key={sport.name}>
              <Reveal delay={index * 80}>
                <div className="group relative aspect-[3/4] overflow-hidden rounded-2xl">
                  <Image
                    src={sport.image}
                    alt={sport.alt}
                    fill
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                  <p className="absolute bottom-4 left-4 font-display text-3xl font-bold uppercase text-white">{sport.name}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
        <Reveal className="mt-5">
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
            E também:
            {OTHER_SPORTS.map((sport) => (
              <span key={sport} className="rounded-full border border-line bg-surface px-3 py-1 font-medium text-foreground">
                {sport}
              </span>
            ))}
          </p>
        </Reveal>
      </Section>

      {/* Quatro pilares */}
      <Section id="funcionalidades" className="pb-24">
        <Reveal>
          <Eyebrow>Funcionalidades</Eyebrow>
        </Reveal>
        <Heading>O essencial de um torneio, já incluído.</Heading>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        </div>
      </Section>

      {/* Eventos reais */}
      <Section className="pb-24">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <Heading>Próximos torneios</Heading>
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

      {/* Placar e transmissão: fotografia real com o placar da plataforma por cima */}
      <Section id="placar" className="pb-24">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <div className="relative">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                <Image
                  src="/images/karate-placar.jpg"
                  alt="Combate de karaté num pavilhão, com mesa de árbitros e placar eletrónico"
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="absolute -right-2 -bottom-8 w-[70%] sm:-right-6">
                <ScoreboardMock />
              </div>
            </div>
          </Reveal>
          <div className="pt-8 lg:pt-0">
            <Eyebrow>Placar e transmissão</Eyebrow>
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

      {/* Faixa do pódio */}
      <div className="relative isolate mb-24 overflow-hidden">
        <ParallaxImage src="/images/combate.jpg" alt="Dois lutadores em combate num octógono, com o árbitro atrás" speed={0.45} />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-black/90 via-black/70 to-black/30" />
        <Section className="py-32 text-white sm:py-40">
          <Reveal>
            <Eyebrow>Resultados</Eyebrow>
            <p className="max-w-2xl font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl">
              Do primeiro inscrito ao último pódio.
            </p>
            <p className="mt-5 max-w-xl text-lg text-white/80">
              Chaves, resultados e pódios ficam publicados à medida que as lutas terminam, para atletas, treinadores e
              famílias acompanharem sem perguntar a ninguém.
            </p>
            <LinkButton href="/events" variant="inverse" className="mt-8 h-12 px-6 text-base">
              Ver resultados dos torneios
            </LinkButton>
          </Reveal>
        </Section>
      </div>

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
          <div className="relative isolate overflow-hidden rounded-2xl bg-primary px-6 py-16 text-center text-white sm:py-20">
            <Image
              src="/images/grappling.jpg"
              alt=""
              fill
              sizes="(min-width: 1152px) 1152px, 100vw"
              className="-z-10 object-cover opacity-20 mix-blend-multiply"
            />
            <h2 className="font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight sm:text-6xl">
              Organize o seu próximo torneio na Camps
            </h2>
            <p className="mx-auto mt-4 max-w-md text-white/90">
              Criar a organização e publicar o evento leva poucos minutos. As inscrições abrem logo a seguir.
            </p>
            <Link
              href="/manage"
              className="mt-8 inline-flex h-12 items-center justify-center rounded-lg bg-white px-8 text-base font-semibold text-primary transition-colors hover:bg-white/90"
            >
              Começar agora
            </Link>
          </div>
        </Reveal>
      </Section>
    </div>
  );
}
