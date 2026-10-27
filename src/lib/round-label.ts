import { GRAND_FINAL_KEY } from "./brackets/double-elimination";
import { BRONZE_KEY } from "./brackets/single-elimination";

const FROM_END = ["Final", "Semifinal", "Quartos de final", "Oitavos de final"];

/**
 * Nome da ronda de uma luta, para o historial do atleta. `lastRound` é a última ronda da chave
 * (na dupla eliminação, a da chave principal), que diz quantas rondas faltam até à final.
 */
export function roundLabel(
  type: "SINGLE_ELIMINATION" | "DOUBLE_ELIMINATION" | "ROUND_ROBIN",
  match: { key: string; round: number },
  lastRound: number,
): string {
  if (type === "ROUND_ROBIN") return `Ronda ${match.round}`;
  if (match.key === BRONZE_KEY) return "Disputa de 3.º lugar";
  if (match.key === GRAND_FINAL_KEY) return "Final";
  if (type === "DOUBLE_ELIMINATION" && match.key.startsWith("L")) return `Chave dos vencidos · ronda ${match.round}`;
  const label = FROM_END[lastRound - match.round] ?? `Ronda ${match.round}`;
  return type === "DOUBLE_ELIMINATION" && label === "Final" ? "Final da chave principal" : label;
}
