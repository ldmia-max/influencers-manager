-- Cifras que reporta el creador, para el contenido efimero.
--
-- Una historia no deja enlace y sus vistas solo las ve su autor, asi que
-- el unico modo de tenerlas es que las diga y alguien las anote. Eso las
-- hace distintas de las que lee Apify, y por eso llevan origen: si un
-- numero de palabra se suma en el mismo total que uno verificado, el
-- cliente no puede distinguirlos.
--
-- Aditiva. Todo lo que ya existe queda como MEDIDA, que es su origen
-- real: lo escribio el refresco automatico.

-- CreateEnum
CREATE TYPE "OrigenMetrica" AS ENUM ('MEDIDA', 'REPORTADA');

-- AlterTable
ALTER TABLE "CampaignEntregaMetrica" ADD COLUMN     "origen" "OrigenMetrica" NOT NULL DEFAULT 'MEDIDA',
ADD COLUMN     "reportadaPorId" TEXT;

-- AddForeignKey
ALTER TABLE "CampaignEntregaMetrica" ADD CONSTRAINT "CampaignEntregaMetrica_reportadaPorId_fkey" FOREIGN KEY ("reportadaPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
