-- Quien de la agencia decidio un influencer en nombre del cliente.
-- Columna opcional y nueva: no toca ninguna fila existente.
ALTER TABLE "CampaignProfile" ADD COLUMN "decididoPorAgenciaId" TEXT;

ALTER TABLE "CampaignProfile" ADD CONSTRAINT "CampaignProfile_decididoPorAgenciaId_fkey" FOREIGN KEY ("decididoPorAgenciaId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
