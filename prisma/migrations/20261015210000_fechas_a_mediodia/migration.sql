-- Las fechas sueltas pasan de medianoche a mediodia UTC.
--
-- Una fecha escrita en un formulario ("2026-10-12") se convertia con
-- new Date(valor), que da las 00:00 UTC. En Bogota —UTC-5— eso son las
-- 19:00 del dia 11, asi que la fecha se guardaba bien y se leia un dia
-- antes en todas partes: en la ficha, y tambien en los avisos de
-- vencimiento, que reducen la fecha al dia de la agencia y por eso
-- reclamaban las entregas con un dia de adelanto.
--
-- El codigo ya guarda a mediodia, que deja doce horas de margen a cada
-- lado y no cambia de dia en ninguna zona horaria. Esto arregla lo que
-- ya estaba guardado.
--
-- Solo las que estan EXACTAMENTE a medianoche: son las que vienen de un
-- campo de fecha, sin hora. Una con hora real la puso otra cosa y
-- moverla seria inventar.
UPDATE "CampaignEntrega"
SET "publicadoEn" = "publicadoEn" + interval '12 hours'
WHERE "publicadoEn" IS NOT NULL
  AND "publicadoEn" = date_trunc('day', "publicadoEn");

UPDATE "CampaignService"
SET "fechaLimite" = "fechaLimite" + interval '12 hours'
WHERE "fechaLimite" IS NOT NULL
  AND "fechaLimite" = date_trunc('day', "fechaLimite");
