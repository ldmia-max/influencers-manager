-- Etapas de campana: Abierta, Revisión, En proceso, Cerrada, Cancelada.
--
-- Los nombres del enum se conservan (DRAFT, REVIEW, ACTIVE, COMPLETED,
-- CANCELLED): renombrarlos obligaria a reescribir cada fila y cada
-- consulta a cambio de nada, porque lo que se lee en pantalla lo decide
-- CAMPAIGN_STATUS_LABELS.
--
-- PENDING deja de usarse. Significaba "el cliente rechazo a alguien y la
-- agencia debe ajustar", que ahora es exactamente "Abierta": el unico
-- estado donde se puede editar. Las campanas guardadas asi se mueven
-- alli, que es donde su usuario puede seguir trabajando. El valor se
-- queda en el enum porque quitarlo obliga a recrear el tipo en Postgres,
-- y no compensa por una etiqueta que ya no se muestra.

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "canceladaEn" TIMESTAMP(3),
ADD COLUMN     "motivoCancelacion" TEXT;

-- Las campanas que esperaban ajustes pasan a Abierta
UPDATE "Campaign" SET "status" = 'DRAFT' WHERE "status" = 'PENDING';
