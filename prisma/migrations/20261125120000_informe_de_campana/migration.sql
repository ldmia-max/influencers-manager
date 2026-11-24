-- AlterTable
ALTER TABLE "CampaignEntrega" ADD COLUMN     "miniaturaUrl" TEXT;

-- CreateTable
CREATE TABLE "InformeCampana" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "analisis" JSONB NOT NULL,
    "actualizadoPorId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InformeCampana_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InformeCampana_campaignId_key" ON "InformeCampana"("campaignId");

-- AddForeignKey
ALTER TABLE "InformeCampana" ADD CONSTRAINT "InformeCampana_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InformeCampana" ADD CONSTRAINT "InformeCampana_actualizadoPorId_fkey" FOREIGN KEY ("actualizadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

