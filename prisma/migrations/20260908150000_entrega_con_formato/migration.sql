-- Que formato es cada entrega.
--
-- Sin esto la pieza no contratada por linea propia no se podia registrar:
-- un combo ("Reel + 3 Stories") no tiene ProfileService detras, asi que
-- el servidor lo trataba como formato con enlace y exigia una URL que una
-- Story no tiene.
--
-- Nulo en todo lo ya registrado: esas entregas siguen leyendo su formato
-- del contrato, que para un formato simple es exacto.
ALTER TABLE "CampaignEntrega" ADD COLUMN "serviceTypeId" TEXT;

CREATE INDEX "CampaignEntrega_serviceTypeId_idx" ON "CampaignEntrega"("serviceTypeId");

ALTER TABLE "CampaignEntrega"
  ADD CONSTRAINT "CampaignEntrega_serviceTypeId_fkey"
  FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
