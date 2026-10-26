import { mediaUrl } from "./image-file";

/**
 * Modalidades aceites num evento, com a fotografia usada nos eventos sem imagem própria.
 */
export const SPORTS = [
  { name: "Jiu-Jitsu", image: "/images/jiu-jitsu.jpg" },
  { name: "Judo", image: "/hero/luta.jpg" },
  { name: "Grappling", image: "/images/grappling.jpg" },
  { name: "Karaté", image: "/images/karate-combate.jpg" },
  { name: "Kickboxing", image: "/images/torneio-infantil.jpg" },
  { name: "Taekwondo", image: "/images/taekwondo.jpg" },
  { name: "Luta", image: "/hero/finalizacao.jpg" },
  { name: "Boxe", image: "/images/karate-placar.jpg" },
  { name: "MMA", image: "/images/grappling.jpg" },
  { name: "Sambo", image: "/images/atleta.jpg" },
] as const;

export const SPORT_NAMES: readonly string[] = SPORTS.map((sport) => sport.name);

export function sportImage(sport: string): string {
  return SPORTS.find((entry) => entry.name === sport)?.image ?? "/hero/torneio.jpg";
}

/** A imagem que o organizador carregou ou, sem ela, a fotografia da modalidade. */
export function eventImage(event: { sport: string; imageKey: string | null }): string {
  return event.imageKey ? mediaUrl(event.imageKey) : sportImage(event.sport);
}
