import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { MAX_IMAGE_SIDE, normalizeImage } from "./images";

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 30, b: 40 } } });

/** Uma "fotografia de telemóvel": JPEG com localização GPS, modelo do aparelho e orientação. */
async function phonePhoto(width: number, height: number, orientation = 1) {
  // A orientação só fica gravada pelo withMetadata; o withExif sozinho escreve sempre 1.
  const bytes = await solid(width, height)
    .jpeg()
    .withMetadata({ orientation })
    .withExifMerge({
      IFD0: { Make: "Telemovel", Model: "Modelo X" },
      IFD3: { GPSLatitudeRef: "S", GPSLatitude: "8/1 50/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "13/1 14/1 0/1" },
    })
    .toBuffer();
  return new Uint8Array(bytes);
}

describe("normalizeImage", () => {
  it("guarda em WebP sem nenhum metadado: sai o GPS e o aparelho", async () => {
    const input = await phonePhoto(800, 600);
    expect((await sharp(input).metadata()).exif).toBeDefined();
    expect(Buffer.from(input).includes("Modelo X")).toBe(true);

    const output = await normalizeImage(input);
    const meta = await sharp(output).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(Buffer.from(output).includes("Modelo X")).toBe(false);
  });

  it("roda conforme a orientação gravada pelo telemóvel", async () => {
    // Orientação 6: a fotografia foi tirada com o telemóvel de pé e tem de rodar 90°.
    const output = await normalizeImage(await phonePhoto(400, 200, 6));
    const meta = await sharp(output).metadata();
    expect([meta.width, meta.height]).toEqual([200, 400]);
  });

  it("reduz o lado maior a 1920 px e não aumenta imagens pequenas", async () => {
    const wide = await sharp(await normalizeImage(new Uint8Array(await solid(4000, 3000).png().toBuffer()))).metadata();
    expect([wide.width, wide.height]).toEqual([MAX_IMAGE_SIDE, 1440]);
    const tall = await sharp(await normalizeImage(new Uint8Array(await solid(1000, 3000).jpeg().toBuffer()))).metadata();
    expect(tall.height).toBe(MAX_IMAGE_SIDE);
    const small = await sharp(await normalizeImage(new Uint8Array(await solid(300, 200).webp().toBuffer()))).metadata();
    expect([small.width, small.height]).toEqual([300, 200]);
  });

  it("recusa uma imagem partida com um cabeçalho válido", async () => {
    const valid = await phonePhoto(800, 600);
    const broken = new Uint8Array([...valid.slice(0, 200), ...new Uint8Array(500).fill(7)]);
    await expect(normalizeImage(broken)).rejects.toThrow("Não foi possível ler a imagem");
  });
});
