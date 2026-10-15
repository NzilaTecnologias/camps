export type LatLng = { lat: number; lng: number };

/** Centro aproximado do país, para quando não há eventos com localização. */
export const ANGOLA_CENTER: LatLng = { lat: -11.6, lng: 17.6 };

/**
 * Centro aproximado das capitais de província e de outras cidades com torneios.
 * Serve de localização quando o organizador não marcou o ponto exato no mapa.
 */
const CITY_CENTERS: Record<string, LatLng> = {
  luanda: { lat: -8.839, lng: 13.2894 },
  talatona: { lat: -8.9167, lng: 13.1833 },
  viana: { lat: -8.9035, lng: 13.3742 },
  cacuaco: { lat: -8.7768, lng: 13.3693 },
  benguela: { lat: -12.5763, lng: 13.4055 },
  lobito: { lat: -12.3644, lng: 13.5366 },
  huambo: { lat: -12.7761, lng: 15.7392 },
  lubango: { lat: -14.9177, lng: 13.4925 },
  cabinda: { lat: -5.55, lng: 12.2 },
  namibe: { lat: -15.1961, lng: 12.1522 },
  mocamedes: { lat: -15.1961, lng: 12.1522 },
  malanje: { lat: -9.5402, lng: 16.341 },
  saurimo: { lat: -9.6608, lng: 20.3916 },
  uige: { lat: -7.6087, lng: 15.0613 },
  kuito: { lat: -12.3833, lng: 16.9333 },
  luena: { lat: -11.7833, lng: 19.9167 },
  menongue: { lat: -14.6585, lng: 17.691 },
  ondjiva: { lat: -17.0667, lng: 15.7333 },
  sumbe: { lat: -11.2061, lng: 13.8437 },
  ndalatando: { lat: -9.2978, lng: 14.9116 },
  "mbanza kongo": { lat: -6.267, lng: 14.2401 },
  dundo: { lat: -7.38, lng: 20.83 },
  caxito: { lat: -8.5785, lng: 13.6643 },
  soyo: { lat: -6.1349, lng: 12.3689 },
};

const normalize = (city: string) =>
  city
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .trim()
    .toLowerCase();

export function cityCenter(city: string | null): LatLng | null {
  return city ? (CITY_CENTERS[normalize(city)] ?? null) : null;
}

/** Ponto marcado pelo organizador ou, na falta dele, o centro da cidade. */
export function eventLocation(event: {
  latitude: number | null;
  longitude: number | null;
  city: string | null;
}): (LatLng & { exact: boolean }) | null {
  if (event.latitude !== null && event.longitude !== null) {
    return { lat: event.latitude, lng: event.longitude, exact: true };
  }
  const center = cityCenter(event.city);
  return center ? { ...center, exact: false } : null;
}

/** Lê latitude e longitude vindas de um formulário; vazio = sem localização. */
export function parseLatLng(latitude: string, longitude: string): LatLng | null | "invalid" {
  if (!latitude && !longitude) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return "invalid";
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}
