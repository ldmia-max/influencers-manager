-- Las campanas todavia Abiertas pasan al 43%.
--
-- El recargo subio del 40% al 43% porque el 10% de utilidad se calcula
-- sobre el subtotal (base + 19% + 11%) y no sobre la base. Cada campana
-- congela su margen al crearse, asi que las que ya existian se quedaron
-- con el viejo.
--
-- Solo se tocan las DRAFT: son las que ningun cliente ha visto. Una en
-- REVIEW ya lleva un enlace de aprobacion con precios dentro, y una
-- ACTIVE o COMPLETED describe trabajo contratado; cambiarles el margen
-- haria que el total dejara de coincidir con lo que el cliente aprobo.
--
-- Y solo las que siguen en el 40% exacto. Si alguien le puso a mano un
-- margen distinto desde "Ajustar", esa fue una decision deliberada y no
-- se pisa. La comparacion va por diferencia y no por igualdad porque la
-- columna es un Float.
UPDATE "Campaign"
SET "markupPercentage" = 0.43
WHERE "status" = 'DRAFT'
  AND ABS("markupPercentage" - 0.4) < 0.0001;
