-- Cifras que ningun scraper puede leer, anotadas a mano sobre la entrega.
--
-- El alcance solo lo mide Instagram y solo lo ve el autor del contenido;
-- los compartidos y los reposteos no los publica Instagram en absoluto.
-- Van en la entrega y no en una captura porque el refresco diario crea
-- una captura nueva cada manana, y ahi irian nulos: al leerse siempre la
-- ultima captura, el dato escrito a mano desapareceria al dia siguiente.
ALTER TABLE "CampaignEntrega" ADD COLUMN "alcance" INTEGER;
ALTER TABLE "CampaignEntrega" ADD COLUMN "compartidosReportados" INTEGER;
ALTER TABLE "CampaignEntrega" ADD COLUMN "reposteosReportados" INTEGER;
ALTER TABLE "CampaignEntrega" ADD COLUMN "cifrasAnotadasEn" TIMESTAMP(3);
