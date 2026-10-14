-- Como factura un influencer, que es lo que decide sus impuestos.
--
-- Natural  -> sin IVA, retencion del 10%.
-- Juridica -> IVA del 19%, retencion del 11%.
CREATE TYPE "TipoPersona" AS ENUM ('NATURAL', 'JURIDICA');

-- El tipo conocido del influencer, y si se confirmo mirando su RUT.
ALTER TABLE "Profile" ADD COLUMN "tipoPersona" "TipoPersona";
ALTER TABLE "Profile" ADD COLUMN "tipoPersonaVerificado" BOOLEAN NOT NULL DEFAULT false;

-- El pago: el RUT, el tipo con el que se calculo, la fecha del
-- documento de la DIAN, el ajuste con su motivo y si lo paga el cliente.
ALTER TABLE "PagoInfluencer" ADD COLUMN "rutUrl" TEXT;
ALTER TABLE "PagoInfluencer" ADD COLUMN "rutNombre" TEXT;
ALTER TABLE "PagoInfluencer" ADD COLUMN "tipoPersona" "TipoPersona";
ALTER TABLE "PagoInfluencer" ADD COLUMN "fechaDocumento" TIMESTAMP(3);
ALTER TABLE "PagoInfluencer" ADD COLUMN "ajuste" DECIMAL(12,2);
ALTER TABLE "PagoInfluencer" ADD COLUMN "motivoAjuste" TEXT;
ALTER TABLE "PagoInfluencer" ADD COLUMN "loPagaElCliente" BOOLEAN NOT NULL DEFAULT false;

-- Los abonos parciales. El saldo baja con cada uno y llega a cero
-- cuando se termino de pagar.
CREATE TABLE "AbonoPago" (
    "id" TEXT NOT NULL,
    "pagoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "observacion" TEXT,
    "registradoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbonoPago_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AbonoPago_pagoId_idx" ON "AbonoPago"("pagoId");

ALTER TABLE "AbonoPago" ADD CONSTRAINT "AbonoPago_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "PagoInfluencer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AbonoPago" ADD CONSTRAINT "AbonoPago_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
