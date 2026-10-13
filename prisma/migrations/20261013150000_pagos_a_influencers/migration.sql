-- El pago a un influencer por su trabajo en una campana.
--
-- Uno por influencer y campana. No guarda el importe —sale de lo
-- contratado— ni el estado —se deduce de que documentos hay—, para no
-- tener dos numeros de lo mismo ni un estado que alguien deba mantener
-- al dia.
CREATE TABLE "PagoInfluencer" (
    "id" TEXT NOT NULL,
    "campaignProfileId" TEXT NOT NULL,
    "cuentaCobroUrl" TEXT,
    "cuentaCobroNombre" TEXT,
    "certificadoUrl" TEXT,
    "certificadoNombre" TEXT,
    "fechaCuentaCobro" TIMESTAMP(3),
    "documento" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PagoInfluencer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PagoInfluencer_campaignProfileId_key" ON "PagoInfluencer"("campaignProfileId");
CREATE INDEX "PagoInfluencer_fechaCuentaCobro_idx" ON "PagoInfluencer"("fechaCuentaCobro");

ALTER TABLE "PagoInfluencer" ADD CONSTRAINT "PagoInfluencer_campaignProfileId_fkey" FOREIGN KEY ("campaignProfileId") REFERENCES "CampaignProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
