"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Atraso em milissegundos, para elementos vizinhos entrarem em cascata. */
  delay?: number;
  /**
   * Calcula o atraso pela posição na grelha (o item da lista, ou o próprio elemento,
   * entre os irmãos): numa grelha de 4, cada cartão de uma linha entra um pouco depois.
   */
  stagger?: boolean;
  className?: string;
};

const STAGGER_COLUMNS = 4;
const STAGGER_STEP_MS = 80;

/**
 * Faz o conteúdo surgir com movimento: o que está no ecrã ao abrir entra logo,
 * o resto quando chega ao ecrã ao deslizar.
 *
 * Estados (atributo `data-reveal`, ver globals.css):
 * - `pending`: vem assim do servidor; só fica invisível com JavaScript ativo (classe `js` no html)
 *   e, se a página nunca chegar a ficar interativa, aparece sozinho ao fim de uns segundos;
 * - `hidden`: fora do ecrã, à espera de lá chegar;
 * - `shown`: visível, com a transição de entrada.
 */
export function Reveal({ children, delay = 0, stagger = false, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.dataset.reveal = "static";
      return;
    }

    if (stagger) {
      const item = element.closest("li") ?? element;
      const index = item.parentElement ? Array.from(item.parentElement.children).indexOf(item) : 0;
      element.style.transitionDelay = `${(index % STAGGER_COLUMNS) * STAGGER_STEP_MS}ms`;
    }

    if (element.getBoundingClientRect().top < window.innerHeight) {
      // Já está no ecrã: entra logo, no próximo quadro, para a transição acontecer.
      const frame = requestAnimationFrame(() => (element.dataset.reveal = "shown"));
      return () => cancelAnimationFrame(frame);
    }

    element.dataset.reveal = "hidden";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        element.dataset.reveal = "shown";
        observer.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [stagger]);

  return (
    <div
      ref={ref}
      data-reveal="pending"
      className={className}
      style={stagger ? undefined : { transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
