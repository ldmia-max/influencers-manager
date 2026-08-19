-- Elimina las columnas de IA de SocialAccount.
--
-- Las escribia src/services/social-processor.ts, que nunca llego a
-- importarse en ninguna parte y se retiro junto con el chat de campanas.
-- La unica IA que queda en la aplicacion es la busqueda de prospectos, y
-- no toca esta tabla.
--
-- No hay pérdida de datos: ninguna de las tres se escribio jamas. Antes
-- de aplicar en produccion conviene confirmarlo:
--
--   SELECT count(*) FILTER (WHERE embedding IS NOT NULL)    AS embeddings,
--          count(*) FILTER (WHERE "aiSummary" IS NOT NULL)  AS resumenes,
--          count(*) FILTER (WHERE "aiMetadata" IS NOT NULL) AS metadatos
--   FROM "SocialAccount";
--
-- Si algo devolviera distinto de cero, hay que exportarlo antes: un DROP
-- COLUMN no se deshace con un rollback de despliegue.
--
-- Las extensiones vector y pg_trgm se quedan instaladas a proposito. La
-- migracion inicial las crea, asi que una base de datos nueva las sigue
-- necesitando; retirarlas exigiria tocar tambien esa migracion.

-- AlterTable
ALTER TABLE "SocialAccount" DROP COLUMN "aiMetadata",
DROP COLUMN "aiSummary",
DROP COLUMN "embedding";
