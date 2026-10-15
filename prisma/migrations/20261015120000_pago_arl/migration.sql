-- La ARL, que solo se le pide a quien factura como juridica.
-- Opcional, igual que el RUT: su ausencia no impide registrar ni pagar.
ALTER TABLE "PagoInfluencer" ADD COLUMN "arlUrl" TEXT;
ALTER TABLE "PagoInfluencer" ADD COLUMN "arlNombre" TEXT;
