-- CreateEnum
CREATE TYPE "SceneElementType" AS ENUM ('ENEMY', 'NPC', 'OBJECT', 'NARRATION');

-- AlterTable
ALTER TABLE "Campaign"
ADD COLUMN "scenePreset" TEXT NOT NULL DEFAULT 'RUINS',
ADD COLUMN "sceneTitle" TEXT NOT NULL DEFAULT 'Les ruines sous la pluie',
ADD COLUMN "sceneText" TEXT NOT NULL DEFAULT 'Un grondement sourd traverse les pierres anciennes.';

-- CreateTable
CREATE TABLE "SceneElement" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "type" "SceneElementType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SceneElement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SceneElement_campaignId_isVisible_idx" ON "SceneElement"("campaignId", "isVisible");

-- AddForeignKey
ALTER TABLE "SceneElement" ADD CONSTRAINT "SceneElement_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
