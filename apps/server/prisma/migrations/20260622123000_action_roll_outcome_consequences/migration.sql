-- AlterTable
ALTER TABLE "ActionRoll"
ADD COLUMN "totalFailureConsequenceType" "ActionRollConsequenceType" NOT NULL DEFAULT 'NONE',
ADD COLUMN "totalFailureConsequenceAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "totalFailureConsequenceText" TEXT NOT NULL DEFAULT '',
ADD COLUMN "failureConsequenceType" "ActionRollConsequenceType" NOT NULL DEFAULT 'NONE',
ADD COLUMN "failureConsequenceAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "failureConsequenceText" TEXT NOT NULL DEFAULT '',
ADD COLUMN "successConsequenceType" "ActionRollConsequenceType" NOT NULL DEFAULT 'NONE',
ADD COLUMN "successConsequenceAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "successConsequenceText" TEXT NOT NULL DEFAULT '',
ADD COLUMN "totalSuccessConsequenceType" "ActionRollConsequenceType" NOT NULL DEFAULT 'NONE',
ADD COLUMN "totalSuccessConsequenceAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "totalSuccessConsequenceText" TEXT NOT NULL DEFAULT '';

-- Backfill existing single-effect rolls as the success consequence.
UPDATE "ActionRoll"
SET
  "successConsequenceType" = "consequenceType",
  "successConsequenceAmount" = "consequenceAmount",
  "successConsequenceText" = "consequenceText";
