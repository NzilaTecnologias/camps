"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { ANGOLA_CENTER, type LatLng } from "@/lib/geo";
import { TILE_ATTRIBUTION, TILE_URL, loadLeaflet, pinIcon } from "./leaflet-setup";

type Props = {
  /** Ponto já guardado, se houver. */
  initial: LatLng | null;
  /** Onde o mapa abre quando ainda não há ponto (o centro da cidade, se conhecido). */
  center?: LatLng | null;
};

/**
 * Mapa onde o organizador clica para marcar o local do evento.
 * O ponto segue no formulário em dois campos escondidos, `latitude` e `longitude`.
 */
export function LocationPicker({ initial, center }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState<LatLng | null>(initial);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !container.current) return;
      const start = initial ?? center ?? ANGOLA_CENTER;
      const map = L.map(container.current).setView([start.lat, start.lng], initial ? 15 : center ? 12 : 5);
      mapRef.current = map;
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);

      const place = (lat: number, lng: number) => {
        if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
        else markerRef.current = L.marker([lat, lng], { icon: pinIcon(L), draggable: true }).addTo(map);
        markerRef.current.off("dragend").on("dragend", () => {
          const position = markerRef.current!.getLatLng();
          setPoint({ lat: position.lat, lng: position.lng });
        });
        setPoint({ lat, lng });
      };
      if (initial) place(initial.lat, initial.lng);
      map.on("click", (event) => place(event.latlng.lat, event.latlng.lng));
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // O mapa só é montado uma vez; `initial` e `center` são valores de arranque.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clear() {
    markerRef.current?.remove();
    markerRef.current = null;
    setPoint(null);
  }

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium">Local no mapa</span>
      <div ref={container} className="relative z-0 h-72 w-full overflow-hidden rounded-lg border border-line bg-surface-2" />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>
          {point
            ? `Marcado em ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)} · arraste o marcador para ajustar`
            : "Clique no mapa para marcar o pavilhão. Sem marcação, usa-se o centro da cidade."}
        </span>
        {point && (
          <button type="button" onClick={clear} className="font-semibold text-primary hover:underline">
            Limpar
          </button>
        )}
      </div>
      <input type="hidden" name="latitude" value={point ? point.lat.toFixed(6) : ""} />
      <input type="hidden" name="longitude" value={point ? point.lng.toFixed(6) : ""} />
    </div>
  );
}
