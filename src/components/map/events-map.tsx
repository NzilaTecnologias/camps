"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { ANGOLA_CENTER } from "@/lib/geo";
import { TILE_ATTRIBUTION, TILE_URL, loadLeaflet, pinIcon } from "./leaflet-setup";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  href: string;
  /** Texto curto por baixo do nome, por exemplo a data e a cidade. */
  detail: string;
  /** Falso quando o ponto é só o centro da cidade. */
  exact: boolean;
};

type Props = {
  points: MapPoint[];
  className?: string;
  /** Zoom quando há um só ponto (por exemplo, na página de um evento). */
  singleZoom?: number;
};

/** Conteúdo do balão montado com nós de texto: os nomes vêm dos organizadores. */
function popupContent(point: MapPoint) {
  const box = document.createElement("div");
  box.style.minWidth = "180px";
  const title = document.createElement("a");
  title.href = point.href;
  title.textContent = point.name;
  title.style.cssText = "display:block;font-weight:700;color:#d21f2b;text-decoration:none;margin-bottom:2px";
  const detail = document.createElement("div");
  detail.textContent = point.detail;
  detail.style.cssText = "color:#5d6471;font-size:12px";
  box.append(title, detail);
  if (!point.exact) {
    const note = document.createElement("div");
    note.textContent = "Localização aproximada (centro da cidade)";
    note.style.cssText = "color:#9ba2ae;font-size:11px;margin-top:4px";
    box.append(note);
  }
  return box;
}

/**
 * Pontos com as mesmas coordenadas (vários eventos na mesma cidade) ficariam escondidos
 * uns atrás dos outros: afasta-os um pouco em círculo.
 */
function spread(points: MapPoint[]): MapPoint[] {
  const seen = new Map<string, number>();
  return points.map((point) => {
    const key = `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`;
    const index = seen.get(key) ?? 0;
    seen.set(key, index + 1);
    if (index === 0) return point;
    const angle = index * 2.4;
    const radius = 0.012 * Math.sqrt(index);
    return { ...point, lat: point.lat + radius * Math.sin(angle), lng: point.lng + radius * Math.cos(angle) };
  });
}

export function EventsMap({ points, className = "h-[480px]", singleZoom = 13 }: Props) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;

    loadLeaflet().then((L) => {
      if (cancelled || !container.current) return;
      map = L.map(container.current, { scrollWheelZoom: false });
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 18 }).addTo(map);

      const placed = spread(points);
      for (const point of placed) {
        L.marker([point.lat, point.lng], { icon: pinIcon(L, !point.exact), title: point.name })
          .addTo(map)
          .bindPopup(() => popupContent(point));
      }

      if (placed.length === 0) map.setView([ANGOLA_CENTER.lat, ANGOLA_CENTER.lng], 5);
      else if (placed.length === 1) map.setView([placed[0].lat, placed[0].lng], singleZoom);
      else map.fitBounds(L.latLngBounds(placed.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 12 });
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points, singleZoom]);

  return (
    <div
      ref={container}
      role="region"
      aria-label="Mapa de eventos"
      className={`relative z-0 w-full overflow-hidden rounded-2xl border border-line bg-surface-2 ${className}`}
    />
  );
}
