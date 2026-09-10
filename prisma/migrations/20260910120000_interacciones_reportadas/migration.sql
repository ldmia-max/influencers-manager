-- Interacciones en un solo numero, para las cifras que se anotan a mano.
--
-- Una story no se puede desglosar: su autor ve en su panel un total de
-- respuestas y reacciones, sin separar unas de otras. Pedir "me gusta" y
-- "comentarios" por separado seria pedirle algo que no tiene delante.
--
-- Nulo en todo lo ya guardado y en lo que mida el scraper: ahi el
-- desglose si existe y las interacciones se siguen sumando de el.
ALTER TABLE "CampaignEntregaMetrica" ADD COLUMN "interacciones" INTEGER;
