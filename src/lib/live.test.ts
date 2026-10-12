import { describe, expect, it } from "vitest";
import { clockRemainingMs, formatClock, formatDuration, type Clock } from "./scoreboard";
import { parseStreamUrl } from "./stream";

describe("parseStreamUrl", () => {
  it("reconhece os vários formatos de endereço do YouTube", () => {
    const embed = { provider: "YouTube", embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" };
    expect(parseStreamUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual(embed);
    expect(parseStreamUrl("https://youtu.be/dQw4w9WgXcQ?si=abc")).toEqual(embed);
    expect(parseStreamUrl("https://www.youtube.com/live/dQw4w9WgXcQ")).toEqual(embed);
    expect(parseStreamUrl("  https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10s ")).toEqual(embed);
  });

  it("embute vídeos do Facebook pelo leitor oficial", () => {
    const result = parseStreamUrl("https://www.facebook.com/ligacamps/videos/1234567890/");
    expect(result?.provider).toBe("Facebook");
    expect(result?.embedUrl).toBe(
      "https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fligacamps%2Fvideos%2F1234567890%2F&show_text=false",
    );
    expect(parseStreamUrl("https://fb.watch/abc123/")?.provider).toBe("Facebook");
  });

  it("recusa outros sítios, endereços sem https e identificadores inválidos", () => {
    expect(parseStreamUrl("https://malicioso.example/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseStreamUrl("https://youtube.com.malicioso.example/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseStreamUrl("http://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseStreamUrl("javascript:alert(1)")).toBeNull();
    expect(parseStreamUrl("https://www.youtube.com/watch?v=curto")).toBeNull();
    expect(parseStreamUrl('https://www.youtube.com/watch?v="><script>')).toBeNull();
    expect(parseStreamUrl("https://www.youtube.com/@canal")).toBeNull();
    expect(parseStreamUrl("https://www.facebook.com/ligacamps")).toBeNull();
    expect(parseStreamUrl("")).toBeNull();
  });
});

describe("cronómetro do placar", () => {
  const stopped: Clock = { durationSeconds: 300, remainingMs: 300_000, startedAt: null };

  it("parado, mostra o tempo guardado, passe o tempo que passar", () => {
    expect(clockRemainingMs(stopped, 1_000_000)).toBe(300_000);
  });

  it("a correr, desconta o tempo desde o arranque e nunca desce de zero", () => {
    const running: Clock = { ...stopped, startedAt: 1_000_000 };
    expect(clockRemainingMs(running, 1_000_000)).toBe(300_000);
    expect(clockRemainingMs(running, 1_090_500)).toBe(209_500);
    expect(clockRemainingMs(running, 2_000_000)).toBe(0);
  });

  it("não ganha tempo se o relógio do ecrã estiver atrasado em relação ao arranque", () => {
    expect(clockRemainingMs({ ...stopped, startedAt: 1_000_000 }, 999_000)).toBe(300_000);
  });

  it("formata minutos e segundos, arredondando para cima", () => {
    expect(formatClock(300_000)).toBe("5:00");
    expect(formatClock(209_500)).toBe("3:30");
    expect(formatClock(9_001)).toBe("0:10");
    expect(formatClock(1)).toBe("0:01");
    expect(formatClock(0)).toBe("0:00");
  });

  it("descreve a duração por extenso", () => {
    expect(formatDuration(300)).toBe("5 min");
    expect(formatDuration(90)).toBe("1 min 30 s");
  });
});
