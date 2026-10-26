import {
  doubleEliminationPlacements,
  generateDoubleElimination,
  generateRoundRobin,
  generateSingleElimination,
  recordDoubleEliminationResult,
  recordResult,
  roundRobinPlacements,
  singleEliminationPlacements,
  type BracketMatch,
  type MatchLink,
  type MatchStatus,
  type Slot,
} from "@/lib/brackets";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/errors";

export const BRACKET_KINDS = ["SINGLE_ELIMINATION", "DOUBLE_ELIMINATION", "ROUND_ROBIN"] as const;
export type BracketKind = (typeof BRACKET_KINDS)[number];

export function parseBracketKind(value: string): BracketKind {
  const kind = BRACKET_KINDS.find((k) => k === value);
  if (!kind) throw new UserError("Tipo de chave inválido");
  return kind;
}

/** Quantos atletas aptos cada tipo de chave precisa. */
export const MIN_COMPETITORS: Record<BracketKind, number> = {
  SINGLE_ELIMINATION: 2,
  DOUBLE_ELIMINATION: 3,
  ROUND_ROBIN: 2,
};

const ENGINE = {
  SINGLE_ELIMINATION: {
    generate: (competitors) => generateSingleElimination(competitors),
    record: recordResult,
    placements: singleEliminationPlacements,
  },
  DOUBLE_ELIMINATION: {
    generate: (competitors) => generateDoubleElimination(competitors),
    record: recordDoubleEliminationResult,
    placements: doubleEliminationPlacements,
  },
  ROUND_ROBIN: {
    generate: (competitors) => generateRoundRobin(competitors),
    record: recordResult,
    placements: roundRobinPlacements,
  },
} satisfies Record<
  BracketKind,
  {
    generate: (competitors: Parameters<typeof generateSingleElimination>[0]) => BracketMatch[];
    record: typeof recordResult;
    placements: (matches: BracketMatch[]) => ReturnType<typeof singleEliminationPlacements>;
  }
>;

type MatchRow = {
  key: string;
  round: number;
  position: number;
  redId: string | null;
  blueId: string | null;
  winnerId: string | null;
  status: Uppercase<MatchStatus>;
  nextKey: string | null;
  nextSlot: Uppercase<Slot> | null;
  loserNextKey: string | null;
  loserNextSlot: Uppercase<Slot> | null;
};

const upper = <T extends string>(value: T) => value.toUpperCase() as Uppercase<T>;
const lower = <T extends string>(value: T) => value.toLowerCase() as Lowercase<T>;

const toLink = (key: string | null, slot: Uppercase<Slot> | null): MatchLink | null =>
  key && slot ? { key, slot: lower(slot) } : null;

function toRow(match: BracketMatch): MatchRow {
  return {
    key: match.key,
    round: match.round,
    position: match.position,
    redId: match.red,
    blueId: match.blue,
    winnerId: match.winner,
    status: upper(match.status),
    nextKey: match.next?.key ?? null,
    nextSlot: match.next ? upper(match.next.slot) : null,
    loserNextKey: match.loserNext?.key ?? null,
    loserNextSlot: match.loserNext ? upper(match.loserNext.slot) : null,
  };
}

function toEngine(row: MatchRow): BracketMatch {
  return {
    key: row.key,
    round: row.round,
    position: row.position,
    red: row.redId,
    blue: row.blueId,
    winner: row.winnerId,
    status: lower(row.status),
    next: toLink(row.nextKey, row.nextSlot),
    loserNext: toLink(row.loserNextKey, row.loserNextSlot),
  };
}

/**
 * Gera (ou regera) a chave de uma categoria com os inscritos pagos que não foram
 * reprovados na pesagem. Recusa regerar se alguma luta já foi disputada.
 */
export async function createBracket(divisionId: string, type: BracketKind) {
  const registrations = await prisma.registration.findMany({
    where: {
      divisionId,
      status: "PAID",
      OR: [{ weighIn: { is: null } }, { weighIn: { is: { passed: true } } }],
    },
    include: { athlete: { select: { academyId: true } } },
  });

  const competitors = registrations.map((r) => ({ id: r.id, academyId: r.athlete.academyId, seed: r.seed }));
  const matches = ENGINE[type].generate(competitors);

  return prisma.$transaction(async (tx) => {
    const started = await tx.match.count({ where: { bracket: { divisionId }, status: "FINISHED" } });
    if (started > 0) throw new UserError("A chave já tem lutas disputadas e não pode ser regerada");

    await tx.bracket.deleteMany({ where: { divisionId } });
    return tx.bracket.create({
      data: { divisionId, type, matches: { create: matches.map(toRow) } },
    });
  });
}

export type ResultDetails = { method?: string; redScore?: number; blueScore?: number };

/** Grava o resultado de uma luta, avança a chave e fecha o pódio quando ela termina. */
export async function reportResult(matchId: string, winnerId: string, details: ResultDetails = {}) {
  return prisma.$transaction(
    async (tx) => {
      const match = await tx.match.findUniqueOrThrow({
        where: { id: matchId },
        include: { bracket: { include: { matches: true } } },
      });
      const { bracket } = match;
      const engine = ENGINE[bracket.type];
      const before = bracket.matches.map(toEngine);
      const after = engine.record(before, match.key, winnerId);

      for (const current of after) {
        const previous = before.find((m) => m.key === current.key) as BracketMatch;
        const isReported = current.key === match.key;
        if (
          !isReported &&
          previous.red === current.red &&
          previous.blue === current.blue &&
          previous.winner === current.winner &&
          previous.status === current.status
        ) {
          continue;
        }
        await tx.match.update({
          where: { bracketId_key: { bracketId: bracket.id, key: current.key } },
          data: {
            redId: current.red,
            blueId: current.blue,
            winnerId: current.winner,
            status: upper(current.status),
            ...(isReported ? { ...details, finishedAt: new Date() } : {}),
          },
        });
      }

      if (after.every((m) => m.status === "finished" || m.status === "bye")) {
        const placements = engine.placements(after);
        await tx.placement.deleteMany({ where: { bracketId: bracket.id } });
        await tx.placement.createMany({
          data: placements.map((p) => ({ bracketId: bracket.id, registrationId: p.competitorId, place: p.place })),
        });
      }
    },
    // Duas mesas podem lançar resultados da mesma chave ao mesmo tempo.
    { isolationLevel: "Serializable" },
  );
}
