"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { canOrganizer, type OrganizerPermission, type OrganizerRole } from "@/lib/organizer-permissions";
import { Icon, type IconName } from "../ui";

type Item = { segment: string; label: string; icon: IconName };
export type NavSection = { title: string; items: Item[] };

type EventItem = Item & { permission: OrganizerPermission };

/** Secções do painel de um evento, pela ordem em que o organizador as usa, e quem as pode abrir. */
export const EVENT_SECTIONS: { title: string; items: EventItem[] }[] = [
  {
    title: "Evento",
    items: [
      { segment: "", label: "Visão geral", icon: "home", permission: "view" },
      { segment: "settings", label: "Página do evento", icon: "settings", permission: "event" },
      { segment: "divisions", label: "Categorias", icon: "layers", permission: "event" },
    ],
  },
  {
    title: "Inscrições",
    items: [
      { segment: "registrations", label: "Inscrições", icon: "users", permission: "view" },
      { segment: "discounts", label: "Descontos e cupões", icon: "ticket", permission: "event" },
      { segment: "payments", label: "Pagamentos e reembolsos", icon: "wallet", permission: "money" },
      { segment: "credits", label: "Créditos", icon: "flag", permission: "money" },
    ],
  },
  {
    title: "Dia da prova",
    items: [
      { segment: "weigh-in", label: "Pesagem", icon: "scale", permission: "floor" },
      { segment: "brackets", label: "Chaves", icon: "bracket", permission: "view" },
      { segment: "schedule", label: "Programação", icon: "clock", permission: "view" },
      { segment: "scoreboard", label: "Placar e áreas", icon: "monitor", permission: "floor" },
      { segment: "streaming", label: "Transmissão", icon: "video", permission: "floor" },
    ],
  },
];

export function EventNav({ eventId, role }: { eventId: string; role: OrganizerRole }) {
  const sections = EVENT_SECTIONS.map((group) => ({
    title: group.title,
    items: group.items.filter((item) => canOrganizer(role, item.permission)),
  })).filter((group) => group.items.length > 0);
  return <SectionNav base={`/manage/events/${eventId}`} sections={sections} label="Secções do evento" />;
}

/**
 * Menu de um painel (evento, federação): coluna fixa ao lado no ecrã largo, faixa deslizante no
 * telemóvel. Assinala a secção aberta (as subpáginas contam como a secção de onde vêm).
 */
export function SectionNav({ base, sections, label }: { base: string; sections: NavSection[]; label: string }) {
  const pathname = usePathname();
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
    <nav aria-label={label} className="lg:sticky lg:top-20">
      <ul ref={list} className="relative -mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0 lg:pb-0">
        {sections.map((group) => (
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
