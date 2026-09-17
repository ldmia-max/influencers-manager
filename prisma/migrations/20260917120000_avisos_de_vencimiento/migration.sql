-- Registro de los correos de vencimiento ya enviados.
--
-- Sin el, una segunda ejecucion del dia —un reintento, un redespliegue,
-- dos entradas de cron sobre la misma ruta— volveria a avisar de lo
-- mismo. Un aviso repetido es la forma mas rapida de que dejen de leerse.
--
-- `clave` es la ocasion del aviso y entra en el unico: para PROXIMO y
-- VENCIDO es la fecha limite, asi que mover el plazo hace que el aviso
-- vuelva a salir (es otro vencimiento); para RESUMEN es el dia del
-- envio, asi el recordatorio semanal puede repetirse cada semana.
CREATE TYPE "TipoAvisoEntrega" AS ENUM ('PROXIMO', 'VENCIDO', 'RESUMEN');

CREATE TABLE "AvisoEntrega" (
    "id" TEXT NOT NULL,
    "tipo" "TipoAvisoEntrega" NOT NULL,
    "clave" TEXT NOT NULL,
    "enviadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "campaignServiceId" TEXT NOT NULL,

    CONSTRAINT "AvisoEntrega_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AvisoEntrega_campaignServiceId_tipo_clave_key"
  ON "AvisoEntrega"("campaignServiceId", "tipo", "clave");

CREATE INDEX "AvisoEntrega_enviadoEn_idx" ON "AvisoEntrega"("enviadoEn");

ALTER TABLE "AvisoEntrega"
  ADD CONSTRAINT "AvisoEntrega_campaignServiceId_fkey"
  FOREIGN KEY ("campaignServiceId") REFERENCES "CampaignService"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
