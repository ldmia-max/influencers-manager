-- Entrega de contenidos y participacion del influencer en la campana.
--
-- Todo es aditivo: las campanas existentes quedan con todos sus
-- influencers en ACTIVO, sus formatos sin fecha limite y sin entregas.
-- Ninguna columna se borra ni cambia de tipo, asi que no hay riesgo de
-- perdida de datos ni ventana de incompatibilidad al desplegar.

-- CreateEnum
CREATE TYPE "ParticipacionCampana" AS ENUM ('ACTIVO', 'RETIRADO');

-- CreateEnum
CREATE TYPE "OrigenRetiro" AS ENUM ('INFLUENCER', 'CLIENTE', 'AGENCIA');

-- AlterTable
ALTER TABLE "CampaignProfile" ADD COLUMN     "motivoRetiro" TEXT,
ADD COLUMN     "origenRetiro" "OrigenRetiro",
ADD COLUMN     "participacion" "ParticipacionCampana" NOT NULL DEFAULT 'ACTIVO',
ADD COLUMN     "retiradoEn" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CampaignService" ADD COLUMN     "fechaLimite" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CampaignEntrega" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "entregadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publicadoEn" TIMESTAMP(3),
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "campaignServiceId" TEXT NOT NULL,
    "registradoPorId" TEXT,

    CONSTRAINT "CampaignEntrega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignEntregaMetrica" (
    "id" TEXT NOT NULL,
    "capturadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vistas" INTEGER,
    "meGusta" INTEGER,
    "comentarios" INTEGER,
    "compartidos" INTEGER,
    "guardados" INTEGER,
    "entregaId" TEXT NOT NULL,

    CONSTRAINT "CampaignEntregaMetrica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignEntrega_campaignServiceId_idx" ON "CampaignEntrega"("campaignServiceId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignEntrega_campaignServiceId_url_key" ON "CampaignEntrega"("campaignServiceId", "url");

-- CreateIndex
CREATE INDEX "CampaignEntregaMetrica_entregaId_capturadoEn_idx" ON "CampaignEntregaMetrica"("entregaId", "capturadoEn");

-- AddForeignKey
ALTER TABLE "CampaignEntrega" ADD CONSTRAINT "CampaignEntrega_campaignServiceId_fkey" FOREIGN KEY ("campaignServiceId") REFERENCES "CampaignService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEntrega" ADD CONSTRAINT "CampaignEntrega_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEntregaMetrica" ADD CONSTRAINT "CampaignEntregaMetrica_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "CampaignEntrega"("id") ON DELETE CASCADE ON UPDATE CASCADE;
