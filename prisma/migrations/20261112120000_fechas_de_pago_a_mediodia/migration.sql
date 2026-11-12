-- Las fechas de pago pasan de medianoche a mediodia UTC.
--
-- Mismo fallo que 20261015210000_fechas_a_mediodia, en los campos que
-- aquella no toco: "2026-11-01" se guardaba como las 00:00 UTC, que en
-- Bogota son las 19:00 del 31 de octubre, y se leia un dia antes en la
-- tabla y en el plazo de 60 dias.
--
-- Solo las que estan EXACTAMENTE a medianoche, que son las que vienen
-- de un campo de fecha.
UPDATE "PagoInfluencer"
SET "fechaCuentaCobro" = "fechaCuentaCobro" + interval '12 hours'
WHERE "fechaCuentaCobro" IS NOT NULL
  AND "fechaCuentaCobro" = date_trunc('day', "fechaCuentaCobro");

UPDATE "PagoInfluencer"
SET "fechaDocumento" = "fechaDocumento" + interval '12 hours'
WHERE "fechaDocumento" IS NOT NULL
  AND "fechaDocumento" = date_trunc('day', "fechaDocumento");

UPDATE "AbonoPago"
SET "fecha" = "fecha" + interval '12 hours'
WHERE "fecha" = date_trunc('day', "fecha");
