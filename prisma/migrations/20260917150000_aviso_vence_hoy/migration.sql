-- Un aviso mas: el propio dia del vencimiento.
--
-- Entre el correo de dos dias antes y el del dia siguiente puede haber
-- tres dias sin recordatorio si el plazo cae en fin de semana —un
-- vencimiento de domingo se avisa el viernes y no se vuelve a mencionar
-- hasta el lunes, ya pasado—. Avisar la manana del propio dia deja
-- todavia margen para llamar al creador.
ALTER TYPE "TipoAvisoEntrega" ADD VALUE 'HOY' AFTER 'PROXIMO';
