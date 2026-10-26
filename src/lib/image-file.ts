// Imagens que os organizadores carregam. O tipo decide-se pelos primeiros bytes do ficheiro, não
// pelo nome nem pelo tipo que o navegador diz: um ficheiro qualquer renomeado para .png é recusado.
// Sem SVG: pode trazer scripts e já esteve na origem de falhas do otimizador de imagens.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type ImageType = keyof typeof IMAGE_TYPES;

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, i) => bytes[offset + i] === byte);

export function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // "RIFF" + tamanho (4 bytes) + "WEBP"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

/** Endereço público de um ficheiro guardado (servido por app/media/[...key]/route.ts). */
export function mediaUrl(key: string): string {
  return `/media/${key}`;
}

/** Tipo pela extensão de uma chave guardada (ex.: "events/abc/123.webp"). */
export function imageTypeOfKey(key: string): ImageType | null {
  const ext = key.split(".").pop();
  const entry = Object.entries(IMAGE_TYPES).find(([, value]) => value === ext);
  return entry ? (entry[0] as ImageType) : null;
}
