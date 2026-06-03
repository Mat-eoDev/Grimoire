-- CreateTable
CREATE TABLE "RevelationAsset" (
    "id" TEXT NOT NULL,
    "type" "SceneElementType" NOT NULL,
    "name" TEXT NOT NULL,
    "imageDataUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevelationAsset_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "SceneElement" ADD COLUMN "assetId" TEXT;

-- CreateIndex
CREATE INDEX "RevelationAsset_type_idx" ON "RevelationAsset"("type");

-- CreateIndex
CREATE INDEX "SceneElement_assetId_idx" ON "SceneElement"("assetId");

-- AddForeignKey
ALTER TABLE "SceneElement" ADD CONSTRAINT "SceneElement_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "RevelationAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
