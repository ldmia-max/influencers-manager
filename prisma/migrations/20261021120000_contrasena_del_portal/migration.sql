-- Enlaces para poner contrasena en el portal del cliente.
--
-- Sirve para las dos cosas, y por eso la tabla no se llama de
-- "recuperacion": el cliente que la olvido y el que nunca tuvo una pasan
-- por el mismo sitio. Hasta ahora la unica forma de entrar al portal era
-- que un administrador se inventara una contrasena y se la hiciera
-- llegar por fuera de la aplicacion.
--
-- Se guarda el SHA-256 del token y nunca el token: leer esta tabla no
-- debe permitir entrar en la cuenta de nadie. Es la misma regla que
-- aplica CampaignApprovalToken con `codeHash`.

CREATE TYPE "OrigenRestablecimiento" AS ENUM ('PORTAL', 'AGENCIA');

CREATE TABLE "ClientPasswordReset" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origen" "OrigenRestablecimiento" NOT NULL DEFAULT 'PORTAL',
    "clientUserId" TEXT NOT NULL,

    CONSTRAINT "ClientPasswordReset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientPasswordReset_tokenHash_key" ON "ClientPasswordReset"("tokenHash");

CREATE INDEX "ClientPasswordReset_clientUserId_idx" ON "ClientPasswordReset"("clientUserId");

ALTER TABLE "ClientPasswordReset"
  ADD CONSTRAINT "ClientPasswordReset_clientUserId_fkey"
  FOREIGN KEY ("clientUserId") REFERENCES "ClientUser"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
