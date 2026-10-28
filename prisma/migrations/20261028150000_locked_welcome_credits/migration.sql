-- AlterTable
ALTER TABLE "Organizer" ADD COLUMN     "welcomeCredits" INTEGER NOT NULL DEFAULT 0;

-- Os créditos de boas-vindas passam a ficar bloqueados até à primeira compra (mínimo 50). As
-- organizações que ainda não compraram nada guardam o que lhes resta da oferta (até 20) como
-- bloqueado, com um movimento no extrato; os atletas já cobrados ficam como estão.
WITH locked AS (
  SELECT o."id", LEAST(o."credits", 20) AS amount
    FROM "Organizer" o
   WHERE o."credits" > 0
     AND EXISTS (SELECT 1 FROM "CreditTransaction" t WHERE t."organizerId" = o."id" AND t."kind" = 'WELCOME')
     AND NOT EXISTS (SELECT 1 FROM "CreditTransaction" t WHERE t."organizerId" = o."id" AND t."kind" = 'PURCHASE')
), updated AS (
  UPDATE "Organizer" o
     SET "credits" = o."credits" - l.amount, "welcomeCredits" = l.amount
    FROM locked l
   WHERE o."id" = l."id"
  RETURNING o."id", o."credits", l.amount
)
INSERT INTO "CreditTransaction" ("id", "organizerId", "kind", "delta", "balance", "note", "createdBy", "createdAt")
SELECT gen_random_uuid()::text, u."id", 'ADJUSTMENT', -u.amount, u."credits",
       'Oferta de boas-vindas bloqueada até à primeira compra de créditos', 'migração', NOW()
  FROM updated u;
