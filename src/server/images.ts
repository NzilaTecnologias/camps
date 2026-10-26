import sharp from "sharp";
import { UserError } from "@/lib/errors";

// Tratamento das imagens carregadas antes de as guardar: o original nunca fica público.
// Cada imagem é descodificada a sério (uma imagem partida é recusada), rodada conforme a
// orientação gravada pelo telemóvel, reduzida e guardada em WebP sem metadados: sai a
// localização GPS, a data e o modelo do aparelho que as fotografias costumam trazer.

/** Lado maior da imagem guardada; chega para o topo da página do evento em ecrãs largos. */
export const MAX_IMAGE_SIDE = 1920;
/** Recusa imagens gigantes antes de as descodificar (protege a memória do servidor). */
const MAX_INPUT_PIXELS = 50_000_000;

export async function normalizeImage(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    const output = await sharp(bytes, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({ width: MAX_IMAGE_SIDE, height: MAX_IMAGE_SIDE, fit: "inside", withoutEnlargement: true })
      // Sem withMetadata(): o sharp não copia EXIF, ICC nem XMP para a imagem nova.
      .webp({ quality: 82 })
      .toBuffer();
    return new Uint8Array(output);
  } catch {
    throw new UserError("Não foi possível ler a imagem: o ficheiro pode estar danificado. Experimente outro.");
  }
}
