import type { Metadata } from "next";
import { InfoCard, InfoHero } from "@/components/info-page";
import { LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "Apoiar — Camps" };

export default function SupportPage() {
  return (
    <>
      <InfoHero
        eyebrow="Apoiar"
        title="Ajude a fazer crescer os desportos de combate em Angola"
        lead="Torneios bem organizados atraem mais atletas, mais público e mais apoios. Há várias formas de fazer parte disso."
        image="/images/torneio-infantil.jpg"
        imageAlt="Crianças a competir num torneio, com pais e treinadores a assistir"
      />

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <InfoCard title="Organize na Camps">
          <p>Leve o próximo torneio da sua liga ou academia para a plataforma. Cada evento torna a comunidade maior.</p>
        </InfoCard>
        <InfoCard title="Inscreva a sua equipa">
          <p>Treinadores podem inscrever todos os atletas da academia com uma só conta e acompanhar os resultados.</p>
        </InfoCard>
        <InfoCard title="Divulgue">
          <p>Partilhe a página dos torneios e das transmissões com atletas, famílias e academias que conhece.</p>
        </InfoCard>
        <InfoCard title="Seja parceiro">
          <p>Federações, ligas e marcas que queiram apoiar o desporto podem associar-se aos torneios como patrocinadores.</p>
        </InfoCard>
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <LinkButton href="/manage">Organizar um torneio</LinkButton>
        <LinkButton href="/sponsors" variant="secondary">
          Saber mais sobre patrocínios
        </LinkButton>
      </div>
    </>
  );
}
