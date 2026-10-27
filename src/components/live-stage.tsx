"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { ScoreboardBug, ScoreboardOverlay } from "./scoreboard-live";
import { buttonClass } from "./ui";

const onFullscreenChange = (notify: () => void) => {
  document.addEventListener("fullscreenchange", notify);
  return () => document.removeEventListener("fullscreenchange", notify);
};
const noSubscription = () => () => {};

/**
 * Leitor da transmissão com o placar da área por cima, posto pela própria Camps: o organizador
 * só cola o endereço do YouTube ou do Facebook, sem OBS nem outro programa. O placar acompanha
 * a luta que estiver no placar da área e pode esconder-se. "Ecrã inteiro" põe em ecrã inteiro a
 * caixa do vídeo (o vídeo não recomeça), com o placar maior, como na televisão.
 */
export function LiveStage({ embedUrl, title, matId }: { embedUrl: string; title: string; matId: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const [showBoard, setShowBoard] = useState(true);
  const full = useSyncExternalStore(onFullscreenChange, () => document.fullscreenElement === stage.current, () => false);
  // O iPhone não deixa pôr em ecrã inteiro uma parte da página: aí fica só o botão do leitor.
  const supported = useSyncExternalStore(noSubscription, () => document.fullscreenEnabled, () => false);

  const toggleFull = () => {
    if (full) void document.exitFullscreen();
    else void stage.current?.requestFullscreen().catch(() => {});
  };
  const boardButton = (
    <button type="button" onClick={() => setShowBoard((value) => !value)} aria-pressed={showBoard} className={buttonClass(full ? "inverse" : "secondary", "sm")}>
      {showBoard ? "Esconder o placar" : "Mostrar o placar"}
    </button>
  );

  return (
    <div>
      <div
        ref={stage}
        className={`relative overflow-hidden bg-black ${full ? "flex items-center justify-center" : "rounded-xl border border-line shadow-sm"}`}
      >
        <iframe
          src={embedUrl}
          title={title}
          className={full ? "h-full w-full" : "aspect-video w-full"}
          allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
        {showBoard && (full ? <ScoreboardOverlay matId={matId} position="absolute bottom-6 left-6" /> : <ScoreboardBug matId={matId} />)}
        {full && (
          <div className="absolute top-4 right-4 flex gap-2">
            {boardButton}
            <button type="button" onClick={toggleFull} className={buttonClass("inverse", "sm")}>
              Sair do ecrã inteiro
            </button>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {supported && (
          <button type="button" onClick={toggleFull} className={buttonClass("primary", "sm")}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
            Ecrã inteiro
          </button>
        )}
        {boardButton}
        <span className="text-xs text-muted">
          {supported
            ? "O placar da área aparece por cima do vídeo enquanto houver uma luta no placar. Esc sai do ecrã inteiro."
            : "O placar da área aparece por cima do vídeo. Para ecrã inteiro, use o botão do leitor de vídeo."}
        </span>
      </div>
    </div>
  );
}
