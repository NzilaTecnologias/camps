"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

type Props = {
  src: string;
  alt: string;
  /** Amplitude do movimento, em fração da altura da faixa (0,45 = desloca-se até 45 % para cada lado). */
  speed?: number;
  className?: string;
};

/**
 * Imagem de fundo com efeito parallax: é mais alta do que a faixa onde está e desloca-se mais
 * devagar do que a página ao deslizar. Só trabalha enquanto a faixa está visível e fica parada
 * para quem pediu menos animação no sistema.
 */
export function ParallaxImage({ src, alt, speed = 0.45, className = "" }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = frame.current;
    const moving = layer.current;
    if (!box || !moving) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let ticking = false;
    let visible = false;
    const update = () => {
      ticking = false;
      const rect = box.getBoundingClientRect();
      // Progresso da faixa no ecrã: -1 quando entra por baixo, 0 centrada, 1 quando sai por cima.
      // Limitado a esse intervalo, a imagem nunca sai da margem extra que tem acima e abaixo.
      const range = window.innerHeight / 2 + rect.height / 2;
      const offset = rect.top + rect.height / 2 - window.innerHeight / 2;
      const progress = Math.max(-1, Math.min(1, offset / range));
      moving.style.transform = `translate3d(0, ${(-progress * speed * rect.height).toFixed(1)}px, 0)`;
    };
    const onScroll = () => {
      if (!visible || ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) update();
    });
    observer.observe(box);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [speed]);

  return (
    <div ref={frame} aria-hidden={alt === "" ? true : undefined} className={`absolute inset-0 -z-10 overflow-hidden ${className}`}>
      {/* Mais alta do que a faixa (a amplitude do movimento acima e abaixo), para nunca deixar ver as pontas. */}
      <div
        ref={layer}
        className="absolute inset-x-0 will-change-transform"
        style={{ top: `-${speed * 100}%`, height: `${100 + speed * 200}%` }}
      >
        <Image src={src} alt={alt} fill sizes="100vw" className="object-cover" />
      </div>
    </div>
  );
}
