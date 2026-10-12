import type { Metadata } from "next";
import { Suspense } from "react";
import { ScoreboardOverlay } from "@/components/scoreboard-live";

export const metadata: Metadata = { title: "Sobreposição do placar — Camps" };

async function Overlay({ params }: { params: Promise<{ matId: string }> }) {
  const { matId } = await params;
  return <ScoreboardOverlay matId={matId} />;
}

/**
 * Placar com fundo transparente para usar como "fonte de navegador" no programa de transmissão
 * (OBS e semelhantes), por cima da imagem da câmara.
 */
export default function OverlayPage({ params }: PageProps<"/overlay/[matId]">) {
  return (
    <>
      <style>{"html, body { background: transparent !important; }"}</style>
      <Suspense fallback={null}>
        <Overlay params={params} />
      </Suspense>
    </>
  );
}
