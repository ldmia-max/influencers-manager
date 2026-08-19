-- Se retira el archivado de campanas.
--
-- Se anadio en la migracion anterior y se descarta por decision del
-- negocio: ni archivado ni borrado desde la aplicacion. Retirar campanas
-- o clientes pasa a ser una operacion del gestor de base de datos.
--
-- Se deja como migracion en vez de borrar la anterior porque esta puede
-- haberse aplicado ya en produccion; el historial debe reflejar lo que
-- realmente ocurrio.

-- AlterTable
ALTER TABLE "Campaign" DROP COLUMN "archivedAt";

