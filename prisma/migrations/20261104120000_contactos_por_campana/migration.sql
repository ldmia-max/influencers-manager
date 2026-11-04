-- Varios contactos por campana, y un acceso al portal por persona.
--
-- Hasta aqui una campana tenia un unico contacto y una empresa un unico
-- acceso al portal, compartido. Las dos cosas desembocaban en lo mismo:
-- la campana registraba que "el cliente" habia aprobado, sin que
-- constase quien, y bastaba una contrasena circulando por la empresa
-- para que cualquiera firmase costes.

-- =====================================================================
-- 1. Quienes pueden aprobar cada campana
-- =====================================================================

CREATE TABLE "CampaignContact" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "campaignId" TEXT NOT NULL,
    "clientContactId" TEXT NOT NULL,

    CONSTRAINT "CampaignContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CampaignContact_clientContactId_idx" ON "CampaignContact"("clientContactId");

CREATE UNIQUE INDEX "CampaignContact_campaignId_clientContactId_key" ON "CampaignContact"("campaignId", "clientContactId");

ALTER TABLE "CampaignContact" ADD CONSTRAINT "CampaignContact_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CampaignContact" ADD CONSTRAINT "CampaignContact_clientContactId_fkey" FOREIGN KEY ("clientContactId") REFERENCES "ClientContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- El principal de cada campana existente entra en la lista. Quien puede
-- aprobar se lee siempre de esta tabla, asi que una campana sin filas
-- seria una campana que nadie puede revisar.
INSERT INTO "CampaignContact" ("id", "createdAt", "campaignId", "clientContactId")
SELECT 'ccp_' || c."id", c."createdAt", c."id", c."clientContactId"
FROM "Campaign" c;

-- =====================================================================
-- 2. A quien se emitio cada enlace, y quien decidio cada influencer
-- =====================================================================

ALTER TABLE "CampaignApprovalToken" ADD COLUMN "clientContactId" TEXT;

ALTER TABLE "CampaignApprovalToken" ADD CONSTRAINT "CampaignApprovalToken_clientContactId_fkey" FOREIGN KEY ("clientContactId") REFERENCES "ClientContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Los enlaces ya emitidos solo guardaban el correo. Se atan al contacto
-- cuando la direccion coincide con la de alguien de esa empresa; los que
-- no coincidan se quedan sin contacto, que es la verdad: no se sabe.
UPDATE "CampaignApprovalToken" t
SET "clientContactId" = cc."id"
FROM "Campaign" c
JOIN "ClientContact" cc ON cc."clientId" = c."clientId"
WHERE t."campaignId" = c."id"
  AND lower(cc."email") = lower(t."sentToEmail");

ALTER TABLE "CampaignProfile" ADD COLUMN "revisadoPorId" TEXT;

ALTER TABLE "CampaignProfile" ADD CONSTRAINT "CampaignProfile_revisadoPorId_fkey" FOREIGN KEY ("revisadoPorId") REFERENCES "ClientContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Lo ya decidido se queda en null a proposito: nadie registro quien fue
-- y rellenarlo con el principal seria inventarse una firma.

-- =====================================================================
-- 3. El acceso al portal pasa a ser de una persona
-- =====================================================================

-- Nullable primero: la columna es obligatoria, pero las filas que ya
-- existen necesitan que se les asigne un contacto antes de exigirla.
ALTER TABLE "ClientUser" ADD COLUMN "clientContactId" TEXT;

-- a) El contacto cuyo correo es el del acceso. Es el caso normal:
--    la agencia creaba el acceso con la direccion del contacto.
UPDATE "ClientUser" u
SET "clientContactId" = (
  SELECT cc."id" FROM "ClientContact" cc
  WHERE cc."clientId" = u."clientId"
    AND lower(cc."email") = lower(u."email")
  ORDER BY cc."isPrimary" DESC, cc."createdAt" ASC
  LIMIT 1
)
WHERE u."clientContactId" IS NULL;

-- b) Si el correo del acceso no es el de nadie, va al contacto
--    principal. El correo de entrada no se toca: cambiarselo dejaria
--    fuera del portal a quien hoy entra con el.
UPDATE "ClientUser" u
SET "clientContactId" = (
  SELECT cc."id" FROM "ClientContact" cc
  WHERE cc."clientId" = u."clientId" AND cc."isActive"
  ORDER BY cc."isPrimary" DESC, cc."createdAt" ASC
  LIMIT 1
)
WHERE u."clientContactId" IS NULL;

-- c) Empresa con acceso y sin un solo contacto. No deberia existir —el
--    formulario siempre crea uno—, pero si existe, borrar su acceso
--    seria dejar a un cliente fuera del portal sin avisar. Se le crea
--    el contacto que le faltaba, a partir del propio correo de entrada.
INSERT INTO "ClientContact" ("id", "firstName", "lastName", "email", "isPrimary", "isActive", "createdAt", "updatedAt", "clientId")
SELECT 'ccportal_' || u."id",
       split_part(u."email", '@', 1),
       '(portal)',
       u."email",
       true,
       true,
       NOW(),
       NOW(),
       u."clientId"
FROM "ClientUser" u
WHERE u."clientContactId" IS NULL;

UPDATE "ClientUser" u
SET "clientContactId" = 'ccportal_' || u."id"
WHERE u."clientContactId" IS NULL;

ALTER TABLE "ClientUser" ALTER COLUMN "clientContactId" SET NOT NULL;

CREATE UNIQUE INDEX "ClientUser_clientContactId_key" ON "ClientUser"("clientContactId");

ALTER TABLE "ClientUser" ADD CONSTRAINT "ClientUser_clientContactId_fkey" FOREIGN KEY ("clientContactId") REFERENCES "ClientContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deja de haber un acceso por empresa. El indice unico se cae, pero hace
-- falta uno normal: PostgreSQL no indexa las claves ajenas por su
-- cuenta, y por clientId se consulta en cada entrada al portal.
DROP INDEX "ClientUser_clientId_key";

CREATE INDEX "ClientUser_clientId_idx" ON "ClientUser"("clientId");
