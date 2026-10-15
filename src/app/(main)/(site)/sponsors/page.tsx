import type { Metadata } from "next";
import { CheckList, InfoCard, InfoHero } from "@/components/info-page";
import { LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "Patrocínios — Camps" };

export default function SponsorsPage() {
  return (
    <>
      <InfoHero
        eyebrow="Patrocínios"
        title="A sua marca no tatami e em direto"
        lead="Os torneios de desportos de combate reúnem atletas, famílias e academias de todo o país. Patrocinar é estar onde essa comunidade está."
        image="/images/taekwondo.jpg"
        imageAlt="Combate de taekwondo com público a assistir"
      />

      <div className="grid gap-5 md:grid-cols-3">
        <InfoCard title="Para marcas">
          <p>Associe a sua marca a torneios específicos, a uma modalidade ou a uma temporada inteira de competições.</p>
        </InfoCard>
        <InfoCard title="Para organizadores">
          <p>
            Patrocinadores ajudam a pagar pavilhões, arbitragem e prémios. Mostrar o alcance do torneio torna essa
            conversa mais fácil.
          </p>
        </InfoCard>
        <InfoCard title="Para a comunidade">
          <p>Mais apoio significa torneios melhores, inscrições mais acessíveis e mais oportunidades para os atletas.</p>
        </InfoCard>
      </div>

      <section className="mt-12 grid items-start gap-8 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-4xl font-bold uppercase leading-none">Onde um torneio é visto</h2>
          <p className="mt-3 text-muted">
            Estes são os pontos de contacto de um torneio na Camps. O destaque de patrocinadores nestes espaços está em
            desenvolvimento.
          </p>
        </div>
        <CheckList
          items={[
            "Página pública do evento, partilhada por atletas e academias",
            "Chaves e resultados, consultados durante e depois do torneio",
            "Ecrãs de placar junto às áreas de luta",
            "Transmissão em direto e sobreposição do placar no vídeo",
          ]}
        />
      </section>

      <div className="mt-12">
        <LinkButton href="/support" variant="secondary">
          Outras formas de apoiar
        </LinkButton>
      </div>
    </>
  );
}
