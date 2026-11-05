-- Mes y ano a los que se imputa la campana.
--
-- No son las fechas de ejecucion: el presupuesto de mercadeo se cierra
-- por meses y de ese sobre sale lo que se le paga a cada influencer.
-- Una campana del 28 de octubre al 15 de noviembre se paga con el
-- presupuesto de uno de los dos meses, y cual de ellos es una decision
-- que no se deduce de startDate. /pagos lo derivaba de ahi, acertaba
-- por casualidad y no se podia corregir.
--
-- Se rellenan antes de volverlos obligatorios, asi que ninguna campana
-- queda fuera del control de gastos: el mes de su fecha de inicio, o el
-- de su creacion cuando no tiene fecha. Es lo que /pagos ya venia
-- mostrando, de modo que la migracion no cambia ninguna cifra; solo
-- convierte en editable un dato que antes era deducido.
--
-- Las dos fechas NO se tratan igual, y mezclarlas se come un mes:
--
--   startDate es una fecha, no un instante. Se guarda a mediodia UTC
--   (ver 20261015210000_fechas_a_mediodia) justo para que leerla en
--   crudo de el dia correcto; las filas antiguas del seed estan a
--   medianoche UTC, que en Bogota es el dia 30 del mes anterior. Pasar
--   "1 de mayo" por la zona horaria lo convierte en abril.
--
--   createdAt si es un instante, y ahi la zona importa al reves: una
--   campana creada el 31 a las 20:00 en Bogota es el dia 1 en UTC y se
--   imputaria al mes siguiente.

ALTER TABLE "Campaign" ADD COLUMN "mes" INTEGER,
                       ADD COLUMN "anio" INTEGER;

UPDATE "Campaign"
SET "mes" = EXTRACT(
      MONTH FROM COALESCE(
        "startDate",
        "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota'
      )
    )::int,
    "anio" = EXTRACT(
      YEAR FROM COALESCE(
        "startDate",
        "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota'
      )
    )::int;

ALTER TABLE "Campaign" ALTER COLUMN "mes" SET NOT NULL,
                       ALTER COLUMN "anio" SET NOT NULL;

-- Contabilidad agrupa y filtra por periodo.
CREATE INDEX "Campaign_anio_mes_idx" ON "Campaign"("anio", "mes");
