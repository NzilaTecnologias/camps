import type * as Leaflet from "leaflet";

// Mapas do OpenStreetMap: gratuitos e sem chave, mas com uma política de uso justo.
// Com muito tráfego, trocar por um fornecedor de mosaicos com contrato.
export const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** O Leaflet mexe em `window` ao ser importado, por isso só é carregado no navegador. */
export async function loadLeaflet(): Promise<typeof Leaflet> {
  return (await import("leaflet")).default;
}

/** Marcador vermelho desenhado em SVG, para não depender das imagens por omissão do Leaflet. */
export function pinIcon(L: typeof Leaflet, muted = false) {
  const color = muted ? "#6b7280" : "#d21f2b";
  return L.divIcon({
    className: "",
    iconSize: [30, 40],
    iconAnchor: [15, 38],
    popupAnchor: [0, -34],
    html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 3px rgb(0 0 0 / .35))"><path d="M15 39s13-13.4 13-23.5C28 7.5 22.2 2 15 2S2 7.5 2 15.5C2 25.6 15 39 15 39Z" fill="${color}" stroke="#fff" stroke-width="2"/><circle cx="15" cy="15.5" r="5" fill="#fff"/></svg>`,
  });
}
