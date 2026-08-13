-- Remplace les 15 colonnes plates "<palier>Consequence<Type|Amount|Text>" de ActionRoll
-- par une table fille (jet, palier) -> effet.
--
-- Ordre important : la table est creee et alimentee AVANT la suppression des colonnes,
-- sinon les donnees des jets en cours seraient perdues. Seuls les effets reellement
-- parametres sont repris (type <> 'NONE') : un palier absent vaut "aucun effet".

-- CreateEnum
CREATE TYPE "RollOutcome" AS ENUM ('TOTAL_FAILURE', 'FAILURE', 'SUCCESS', 'TOTAL_SUCCESS');

-- CreateTable
CREATE TABLE "ActionRollConsequence" (
    "id" TEXT NOT NULL,
    "rollId" TEXT NOT NULL,
    "outcome" "RollOutcome" NOT NULL,
    "type" "ActionRollConsequenceType" NOT NULL DEFAULT 'NONE',
    "amount" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ActionRollConsequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionRollConsequence_rollId_idx" ON "ActionRollConsequence"("rollId");

-- CreateIndex
CREATE UNIQUE INDEX "ActionRollConsequence_rollId_outcome_key" ON "ActionRollConsequence"("rollId", "outcome");

-- AddForeignKey
ALTER TABLE "ActionRollConsequence" ADD CONSTRAINT "ActionRollConsequence_rollId_fkey" FOREIGN KEY ("rollId") REFERENCES "ActionRoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reprise des donnees existantes, un palier a la fois.
INSERT INTO "ActionRollConsequence" ("id", "rollId", "outcome", "type", "amount", "text")
SELECT gen_random_uuid()::text, "id", 'TOTAL_FAILURE'::"RollOutcome",
       "totalFailureConsequenceType", "totalFailureConsequenceAmount", "totalFailureConsequenceText"
FROM "ActionRoll" WHERE "totalFailureConsequenceType" <> 'NONE';

INSERT INTO "ActionRollConsequence" ("id", "rollId", "outcome", "type", "amount", "text")
SELECT gen_random_uuid()::text, "id", 'FAILURE'::"RollOutcome",
       "failureConsequenceType", "failureConsequenceAmount", "failureConsequenceText"
FROM "ActionRoll" WHERE "failureConsequenceType" <> 'NONE';

-- Pour le palier SUCCESS, les anciennes colonnes generiques "consequence*" servaient de
-- repli avant l'ajout des effets par palier : on les reprend si le palier est vide.
INSERT INTO "ActionRollConsequence" ("id", "rollId", "outcome", "type", "amount", "text")
SELECT gen_random_uuid()::text, "id", 'SUCCESS'::"RollOutcome",
       CASE WHEN "successConsequenceType" <> 'NONE' THEN "successConsequenceType" ELSE "consequenceType" END,
       CASE WHEN "successConsequenceType" <> 'NONE' THEN "successConsequenceAmount" ELSE "consequenceAmount" END,
       CASE WHEN "successConsequenceType" <> 'NONE' THEN "successConsequenceText" ELSE "consequenceText" END
FROM "ActionRoll" WHERE "successConsequenceType" <> 'NONE' OR "consequenceType" <> 'NONE';

INSERT INTO "ActionRollConsequence" ("id", "rollId", "outcome", "type", "amount", "text")
SELECT gen_random_uuid()::text, "id", 'TOTAL_SUCCESS'::"RollOutcome",
       "totalSuccessConsequenceType", "totalSuccessConsequenceAmount", "totalSuccessConsequenceText"
FROM "ActionRoll" WHERE "totalSuccessConsequenceType" <> 'NONE';

-- AlterTable : les colonnes ne sont supprimees qu'une fois les donnees reprises.
ALTER TABLE "ActionRoll" DROP COLUMN "consequenceAmount",
DROP COLUMN "consequenceText",
DROP COLUMN "consequenceType",
DROP COLUMN "failureConsequenceAmount",
DROP COLUMN "failureConsequenceText",
DROP COLUMN "failureConsequenceType",
DROP COLUMN "successConsequenceAmount",
DROP COLUMN "successConsequenceText",
DROP COLUMN "successConsequenceType",
DROP COLUMN "totalFailureConsequenceAmount",
DROP COLUMN "totalFailureConsequenceText",
DROP COLUMN "totalFailureConsequenceType",
DROP COLUMN "totalSuccessConsequenceAmount",
DROP COLUMN "totalSuccessConsequenceText",
DROP COLUMN "totalSuccessConsequenceType";
