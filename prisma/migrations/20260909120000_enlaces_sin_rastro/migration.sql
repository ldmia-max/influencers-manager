-- Los enlaces guardados pierden la cola que anaden las apps al copiar.
--
-- Al pegar desde Instagram el enlace llega como
--   .../reel/CODE/?utm_source=ig_web_copy_link&stkn=XXXX
-- y ese `stkn` es un token de la sesion de quien lo copio: no describe la
-- publicacion y no tiene por que estar en la base de datos.
--
-- Ademas rompia las metricas. El actor devuelve la URL canonica, sin
-- parametros, y el emparejamiento comparaba cadenas: no coincidian, la
-- medicion se descartaba en silencio y esa publicacion no aparecia en
-- ninguna grafica. Eso ya se corrigio emparejando por el identificador de
-- la publicacion; esto limpia lo que quedo guardado.
--
-- Se corta por el primer '?' y por el primer '#', salvo en los enlaces de
-- YouTube tipo /watch, donde el parametro `v` ES el identificador del
-- video y quitarlo dejaria el enlace apuntando a ninguna parte.
UPDATE "CampaignEntrega"
SET "url" = split_part(split_part("url", '?', 1), '#', 1)
WHERE "url" IS NOT NULL
  AND ("url" LIKE '%?%' OR "url" LIKE '%#%')
  AND "url" NOT LIKE '%youtube.com/watch%';
