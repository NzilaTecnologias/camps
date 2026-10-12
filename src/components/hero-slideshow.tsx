"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export type Slide = { src: string; alt: string };

const INTERVAL_MS = 6500;

/**
 * Fundo da abertura: as imagens trocam com fundido e cada uma faz um zoom lento.
 * Precisa de pelo menos três slides para o movimento recomeçar do início a cada volta.
 */
export function HeroSlideshow({ slides }: { slides: Slide[] }) {
  // Guarda também o slide anterior, que continua a mexer-se enquanto desaparece.
  const [{ current, previous }, setState] = useState({ current: 0, previous: -1 });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      setState((state) => ({ current: (state.current + 1) % slides.length, previous: state.current }));
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [slides.length, current]);

  return (
    <>
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {slides.map((slide, index) => {
          const isMoving = index === current || index === previous;
          return (
            <div
              key={slide.src}
              className={`absolute inset-0 transition-opacity duration-[1400ms] ease-in-out ${index === current ? "opacity-100" : "opacity-0"}`}
            >
              <Image
                src={slide.src}
                alt=""
                fill
                sizes="100vw"
                priority={index === 0}
                className={`object-cover ${isMoving ? (index % 2 === 0 ? "slide-motion-in" : "slide-motion-out") : ""}`}
              />
            </div>
          );
        })}
      </div>

      <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center gap-2">
        {slides.map((slide, index) => (
          <button
            key={slide.src}
            type="button"
            aria-label={`Mostrar imagem ${index + 1}: ${slide.alt}`}
            aria-current={index === current}
            onClick={() => setState({ current: index, previous: current })}
            className={`h-1.5 rounded-full transition-all duration-500 ${index === current ? "w-10 bg-white" : "w-4 bg-white/40 hover:bg-white/70"}`}
          />
        ))}
      </div>
    </>
  );
}
