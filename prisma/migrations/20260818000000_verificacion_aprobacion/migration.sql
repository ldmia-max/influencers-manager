-- AlterTable
ALTER TABLE "CampaignApprovalToken" ADD COLUMN     "codeAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "codeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "codeHash" TEXT,
ADD COLUMN     "codeSentAt" TIMESTAMP(3),
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedEmail" TEXT;

