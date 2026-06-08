-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REFUSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "TradeOffer" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "offeredEntryId" TEXT NOT NULL,
    "offeredQty" INTEGER NOT NULL DEFAULT 1,
    "requestedEntryId" TEXT,
    "requestedQty" INTEGER NOT NULL DEFAULT 1,
    "status" "TradeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TradeOffer_campaignId_toUserId_status_idx" ON "TradeOffer"("campaignId", "toUserId", "status");

-- CreateIndex
CREATE INDEX "TradeOffer_campaignId_fromUserId_status_idx" ON "TradeOffer"("campaignId", "fromUserId", "status");

-- AddForeignKey
ALTER TABLE "TradeOffer" ADD CONSTRAINT "TradeOffer_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
