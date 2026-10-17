import { describe, expect, it } from "vitest";
import { groupByScreenDistance } from "./map-groups";

describe("groupByScreenDistance", () => {
  const at = (name: string, x: number, y: number) => ({ name, x, y });
  const names = (groups: { name: string }[][]) => groups.map((group) => group.map((point) => point.name));

  it("junta pontos sobrepostos e deixa os afastados à parte", () => {
    const points = [at("Copa Luanda", 100, 100), at("Grappling Luanda", 101, 100), at("Benguela", 100, 300), at("Huambo", 250, 320)];
    expect(names(groupByScreenDistance(points, (p) => p))).toEqual([["Copa Luanda", "Grappling Luanda"], ["Benguela"], ["Huambo"]]);
  });

  it("com zoom (pontos mais afastados no ecrã) os grupos separam-se", () => {
    const points = [at("Copa Luanda", 1000, 1000), at("Grappling Luanda", 1060, 1000)];
    expect(names(groupByScreenDistance(points, (p) => p))).toEqual([["Copa Luanda"], ["Grappling Luanda"]]);
  });
});
