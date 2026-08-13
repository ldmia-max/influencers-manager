-- Cambios solicitados en el formulario del brief.
-- La tabla CampaignBrief tiene 0 filas en produccion, asi que ambas
-- operaciones son seguras.
--
-- Depurado a mano para excluir los DROP de AppSetting y UserSetting.
-- NO ejecutar "prisma db push" contra produccion.

-- AlterTable
ALTER TABLE "CampaignBrief" DROP COLUMN "mensajePrincipal",
ALTER COLUMN "landingUrl" DROP NOT NULL;
