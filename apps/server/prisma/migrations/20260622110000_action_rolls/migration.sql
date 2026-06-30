-- CreateEnum
CREATE TYPE "ActionRollStatus" AS ENUM ('PENDING', 'ROLLED', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActionRollTargetType" AS ENUM ('NONE', 'PLAYER', 'ELEMENT');

-- CreateEnum
CREATE TYPE "ActionRollConsequenceType" AS ENUM ('NONE', 'NARRATION', 'DAMAGE_TARGET', 'DAMAGE_PLAYER', 'DELETE_TARGET');

-- AlterTable
ALTER TABLE "SceneElement"
ADD COLUMN "hp" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "maxHp" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "attack" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "defense" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ActionRoll" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "playerUserId" TEXT NOT NULL,
    "actionText" TEXT NOT NULL,
    "dieSides" INTEGER NOT NULL DEFAULT 20,
    "totalFailureMax" INTEGER NOT NULL DEFAULT 4,
    "successMin" INTEGER NOT NULL DEFAULT 12,
    "totalSuccessMin" INTEGER NOT NULL DEFAULT 18,
    "targetType" "ActionRollTargetType" NOT NULL DEFAULT 'NONE',
    "targetElementId" TEXT,
    "targetUserId" TEXT,
    "consequenceType" "ActionRollConsequenceType" NOT NULL DEFAULT 'NONE',
    "consequenceAmount" INTEGER NOT NULL DEFAULT 0,
    "consequenceText" TEXT NOT NULL DEFAULT '',
    "status" "ActionRollStatus" NOT NULL DEFAULT 'PENDING',
    "result" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionRoll_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionRoll_campaignId_status_idx" ON "ActionRoll"("campaignId", "status");

-- CreateIndex
CREATE INDEX "ActionRoll_playerUserId_status_idx" ON "ActionRoll"("playerUserId", "status");

-- CreateIndex
CREATE INDEX "ActionRoll_targetElementId_idx" ON "ActionRoll"("targetElementId");

-- CreateIndex
CREATE INDEX "ActionRoll_targetUserId_idx" ON "ActionRoll"("targetUserId");

-- AddForeignKey
ALTER TABLE "ActionRoll" ADD CONSTRAINT "ActionRoll_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
