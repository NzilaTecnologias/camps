import { describe, expect, it } from "vitest";
import { imageTypeOfKey, sniffImageType } from "./image-file";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);

describe("sniffImageType", () => {
  it("reconhece JPEG, PNG e WebP pelos primeiros bytes", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00))).toBe("image/png");
    expect(sniffImageType(text("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "))).toBe("image/webp");
  });

  it("recusa SVG, texto e ficheiros vazios, seja qual for o nome", () => {
    expect(sniffImageType(text('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffImageType(text("isto não é uma imagem"))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
    expect(sniffImageType(text("RIFF\u0000\u0000\u0000\u0000WAVEfmt "))).toBeNull();
  });
});

describe("imageTypeOfKey", () => {
  it("dá o tipo pela extensão da chave guardada", () => {
    expect(imageTypeOfKey("events/e1/abc.webp")).toBe("image/webp");
    expect(imageTypeOfKey("events/e1/abc.jpg")).toBe("image/jpeg");
    expect(imageTypeOfKey("events/e1/abc.svg")).toBeNull();
  });
});
