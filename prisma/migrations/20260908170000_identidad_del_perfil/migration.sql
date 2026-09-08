-- Identidad de quien firma y cobra.
--
-- Va aparte de Profile.name porque no siempre es la misma persona: el
-- nombre publico es el artistico, y quien factura puede ser su
-- representante, su manager o una sociedad.
--
-- Dato personal: no lo selecciona ninguna consulta del portal de
-- aprobacion ni del portal del cliente.
CREATE TYPE "TipoDocumento" AS ENUM ('CC', 'CE', 'TI', 'NIT', 'PASAPORTE', 'PEP', 'PPT');

ALTER TABLE "Profile" ADD COLUMN "nombreCompleto" TEXT;
ALTER TABLE "Profile" ADD COLUMN "tipoDocumento" "TipoDocumento";
ALTER TABLE "Profile" ADD COLUMN "numeroDocumento" TEXT;
