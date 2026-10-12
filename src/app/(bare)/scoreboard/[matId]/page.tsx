import type { Metadata } from "next";
import { Suspense } from "react";
import { ScoreboardDisplay } from "@/components/scoreboard-live";

export const metadata: Metadata = { title: "Placar — Camps" };

async function Display({ params }: { params: Promise<{ matId: string }> }) {
  const { matId } = await params;
  return <ScoreboardDisplay matId={matId} />;
}

/** Ecrã inteiro para a televisão ou o projetor de uma área de luta. */
export default function ScoreboardPage({ params }: PageProps<"/scoreboard/[matId]">) {
  return (
    <Suspense fallback={<div className="h-dvh bg-black" />}>
      <Display params={params} />
    </Suspense>
  );
}
