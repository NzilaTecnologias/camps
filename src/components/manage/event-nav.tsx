"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Icon, type IconName } from "../ui";

type Item = { segment: string; label: string; icon: IconName };

/** Secções do painel de um evento, pela ordem em que o organizador as usa. */
export const EVENT_SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: "Evento",
    items: [
      { segment: "", label: "Visão geral", icon: "home" },
      { segment: "settings", label: "Página do evento", icon: "settings" },
      { segment: "divisions", label: "Categorias", icon: "layers" },
    ],
  },
  {
    title: "Inscrições",
    items: [
      { segment: "registrations", label: "Inscrições", icon: "users" },
      { segment: "discounts", label: "Descontos e cupões", icon: "ticket" },
      { segment: "payments", label: "Pagamentos e reembolsos", icon: "wallet" },
    ],
  },
  {
    title: "Dia da prova",
    items: [
      { segment: "weigh-in", label: "Pesagem", icon: "scale" },
      { segment: "brackets", label: "Chaves", icon: "bracket" },
      { segment: "scoreboard", label: "Placar e áreas", icon: "monitor" },
      { segment: "streaming", label: "Transmissão", icon: "video" },
    ],
  },
];

/**
 * Menu do painel do evento: coluna fixa ao lado no ecrã largo, faixa deslizante no telemóvel.
 * Assinala a secção aberta (as páginas de uma categoria contam como "Categorias").
 */
export function EventNav({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  const base = `/manage/events/${eventId}`;
  const current = pathname.slice(base.length).split("/")[1] ?? "";
  const list = useRef<HTMLUListElement>(null);

  // No telemóvel o menu é uma faixa deslizante: traz a secção aberta para a vista, sem mexer na página.
  useEffect(() => {
    const strip = list.current;
    const active = strip?.querySelector<HTMLElement>("[aria-current=page]");
    if (!strip || !active || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollLeft = active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2;
  }, [current]);

  return (
    <nav aria-label="Secções do evento" className="lg:sticky lg:top-20">
      <ul ref={list} className="relative -mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0 lg:pb-0">
        {EVENT_SECTIONS.map((group) => (
          <li key={group.title} className="contents lg:block lg:pb-5">
            <p className="hidden px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted lg:block">
              {group.title}
            </p>
            <ul className="contents lg:block lg:space-y-0.5">
              {group.items.map((item) => {
                const active = current === item.segment;
                return (
                  <li key={item.segment} className="shrink-0">
                    <Link
                      href={item.segment ? `${base}/${item.segment}` : base}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-primary text-primary-fg shadow-sm"
                          : "text-muted hover:bg-foreground/5 hover:text-foreground"
                      }`}
                    >
                      <Icon name={item.icon} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
