-- DropForeignKey
ALTER TABLE "CampaignService" DROP CONSTRAINT "CampaignService_profileServiceId_fkey";

-- AlterTable
ALTER TABLE "CampaignService" ADD COLUMN     "comboDescripcion" TEXT,
ADD COLUMN     "esCombo" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "profileServiceId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "CampaignService" ADD CONSTRAINT "CampaignService_profileServiceId_fkey" FOREIGN KEY ("profileServiceId") REFERENCES "ProfileService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

