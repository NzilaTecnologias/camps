import { prisma } from "@/lib/db";

// Só depende da base de dados, para poder correr também no seed e em scripts.

/**
 * Estatísticas públicas pré-calculadas: medalhas e posição das academias, e inscrições pagas
 * de cada evento. Duas instruções SQL, sem trazer linhas para a aplicação; só escreve o que mudou.
 */
export async function refreshCommunityStats() {
  await prisma.$executeRaw`
    WITH placed AS (
      SELECT ap."academyId" AS academy_id,
             COUNT(DISTINCT ap.id)::int AS athletes,
             COUNT(*) FILTER (WHERE pl.place = 1)::int AS gold,
             COUNT(*) FILTER (WHERE pl.place = 2)::int AS silver,
             COUNT(*) FILTER (WHERE pl.place = 3)::int AS bronze
        FROM "Registration" r
        JOIN "Event" e ON e.id = r."eventId" AND e.status = 'PUBLISHED'
        JOIN "AthleteProfile" ap ON ap.id = r."athleteId"
        LEFT JOIN "Placement" pl ON pl."registrationId" = r.id
       WHERE r.status = 'PAID' AND ap."academyId" IS NOT NULL
       GROUP BY ap."academyId"
    ), ranked AS (
      SELECT a.id,
             COALESCE(p.athletes, 0) AS athletes,
             COALESCE(p.gold, 0) AS gold,
             COALESCE(p.silver, 0) AS silver,
             COALESCE(p.bronze, 0) AS bronze,
             CASE WHEN p.academy_id IS NULL THEN NULL
                  ELSE (ROW_NUMBER() OVER (
                         ORDER BY (p.academy_id IS NULL), p.gold DESC NULLS LAST, p.silver DESC NULLS LAST,
                                  p.bronze DESC NULLS LAST, p.athletes DESC NULLS LAST, a.name ASC))::int
             END AS rank
        FROM "Academy" a
        LEFT JOIN placed p ON p.academy_id = a.id
    )
    UPDATE "Academy" a
       SET "athleteCount" = r.athletes, gold = r.gold, silver = r.silver, bronze = r.bronze, rank = r.rank
      FROM ranked r
     WHERE a.id = r.id
       AND (a."athleteCount", a.gold, a.silver, a.bronze, a.rank)
           IS DISTINCT FROM (r.athletes, r.gold, r.silver, r.bronze, r.rank)`;

  await prisma.$executeRaw`
    UPDATE "Event" e
       SET "paidRegistrations" = c.paid
      FROM (SELECT ev.id, COUNT(r.id)::int AS paid
              FROM "Event" ev
              LEFT JOIN "Registration" r ON r."eventId" = ev.id AND r.status = 'PAID'
             GROUP BY ev.id) c
     WHERE e.id = c.id AND e."paidRegistrations" IS DISTINCT FROM c.paid`;
}
