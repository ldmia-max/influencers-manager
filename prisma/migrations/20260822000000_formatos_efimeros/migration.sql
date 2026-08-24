-- Formatos sin enlace: stories, directos y menciones en directo.
--
-- No es que el link se nos escape: la plataforma no publica ninguno
-- permanente y las metricas solo las ve el creador en su panel. Para
-- estos formatos la entrega se confirma con la fecha de emision y queda
-- registrado quien la confirmo.
--
-- Aditiva y sin perdida de datos: la columna nace en false, y aflojar el
-- NOT NULL de una columna nunca invalida filas existentes.
--
-- Al final se marcan los formatos efimeros que ya existen. Va por
-- nombre y no por id porque los ids son distintos en cada base. Kick
-- "Clip" queda fuera a proposito: sus clips si tienen enlace estable.

-- AlterTable
ALTER TABLE "CampaignEntrega" ALTER COLUMN "url" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ServiceType" ADD COLUMN     "esEfimero" BOOLEAN NOT NULL DEFAULT false;

-- Marcar los formatos efimeros ya sembrados
UPDATE "ServiceType" SET "esEfimero" = true
WHERE "name" IN ('story', 'live', 'mencion_live');
