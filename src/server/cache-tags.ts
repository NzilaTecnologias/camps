import { updateTag } from "next/cache";

// Etiquetas das caches públicas ("use cache"). Cada servidor guarda as suas cópias em memória
// por pouco tempo (perfis "public" e "live" em next.config.ts); quando um organizador muda algo,
// a ação apaga as etiquetas certas para quem fez a mudança ver o resultado logo.

export const TAG = {
  /** Listas de eventos e cidades. */
  events: "events",
  /** Academias, atletas e rankings. */
  community: "community",
  /** Transmissões no ar. */
  live: "live",
  event: (eventId: string) => `event:${eventId}`,
  eventSlug: (slug: string) => `event-slug:${slug}`,
};

/** Só pode ser chamada dentro de server actions (é onde o Next permite updateTag). */
export function publicDataChanged(changes: {
  eventId?: string | null;
  eventSlug?: string | null;
  events?: boolean;
  community?: boolean;
  live?: boolean;
}) {
  if (changes.eventId) updateTag(TAG.event(changes.eventId));
  if (changes.eventSlug) updateTag(TAG.eventSlug(changes.eventSlug));
  if (changes.events) updateTag(TAG.events);
  if (changes.community) updateTag(TAG.community);
  if (changes.live) updateTag(TAG.live);
}
