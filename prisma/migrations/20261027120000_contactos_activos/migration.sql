-- Contactos que se pueden retirar sin borrarlos.
--
-- Un contacto que ya es el de alguna campana no se puede eliminar: esa
-- campana registra quien la aprobo. Hasta ahora eso dejaba a quien se iba
-- de la empresa apareciendo para siempre en el selector de contacto al
-- crear campanas. Desactivarlo lo saca de ahi y conserva la historia.
--
-- Todos los existentes entran activos: es lo que eran hasta hoy.
ALTER TABLE "ClientContact" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
