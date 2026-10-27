import { describe, expect, it } from "vitest";
import { athleteRecord, type Bout } from "./athlete-record";

const at = (day: number) => new Date(Date.UTC(2026, 9, day));
const bout = (won: boolean, method: string | null, day: number): Bout => ({ won, method, finishedAt: at(day) });

describe("athleteRecord", () => {
  it("conta vitórias, derrotas e a percentagem", () => {
    const record = athleteRecord([bout(true, "Finalização", 1), bout(true, "Pontos", 2), bout(false, "Pontos", 3)]);
    expect(record).toMatchObject({ fights: 3, wins: 2, losses: 1, winRate: 67 });
  });

  it("reparte as vitórias por método, o mais frequente primeiro", () => {
    const record = athleteRecord([
      bout(true, "Pontos", 1),
      bout(true, "Finalização", 2),
      bout(true, "Finalização", 3),
      bout(true, null, 4),
    ]);
    expect(record.winsBy).toEqual([
      { method: "Finalização", count: 2, share: 0.5 },
      { method: "Pontos", count: 1, share: 0.25 },
      { method: "Sem método registado", count: 1, share: 0.25 },
    ]);
    expect(record.lossesBy).toEqual([]);
  });

  it("mostra a forma recente e as vitórias seguidas a partir da última luta", () => {
    const record = athleteRecord([
      bout(true, "Pontos", 1),
      bout(false, "Pontos", 2),
      bout(true, "Pontos", 3),
      bout(true, "Pontos", 4),
      bout(true, "Pontos", 5),
      bout(false, "Pontos", 6),
      bout(true, "Pontos", 7),
    ].reverse());
    expect(record.form).toEqual([true, false, true, true, true]);
    expect(record.streak).toBe(1);
  });

  it("sem lutas não há percentagem nem série", () => {
    expect(athleteRecord([])).toMatchObject({ fights: 0, winRate: null, streak: 0, form: [] });
  });
});
