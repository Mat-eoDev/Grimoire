-- CreateEnum
CREATE TYPE "CombatLogKind" AS ENUM ('ATTACK', 'RESOLUTION');

-- CreateTable
CREATE TABLE "CombatLogEntry" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "kind" "CombatLogKind" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CombatLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CombatLogEntry_campaignId_createdAt_idx" ON "CombatLogEntry"("campaignId", "createdAt");

-- AddForeignKey
ALTER TABLE "CombatLogEntry" ADD CONSTRAINT "CombatLogEntry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
