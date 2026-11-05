-- Contrato y "otros" en la documentacion de un pago.
--
-- El contrato es OBLIGATORIO: sin el, estadoDePago() deja el pago en
-- "Faltan documentos", igual que sin cuenta de cobro o sin certificado
-- bancario. Es el unico papel que acredita que se pacto el trabajo que
-- se esta pagando.
--
-- No se rellena nada hacia atras, y eso es lo que se quiere: los pagos
-- que ya tenian cuenta de cobro y certificado pero no contrato vuelven
-- a aparecer como incompletos, que es exactamente lo que son. Los que
-- ya estan registrados o pagados no se mueven, porque esas dos
-- comprobaciones van antes en estadoDePago(): que falte un papel en algo
-- ya pagado es un problema de archivo, no del pago.
--
-- "Otros" va en tabla aparte porque caben varios y no se sabe que son.

ALTER TABLE "PagoInfluencer" ADD COLUMN "contratoUrl" TEXT,
                             ADD COLUMN "contratoNombre" TEXT;

CREATE TABLE "PagoDocumento" (
    "id" TEXT NOT NULL,
    "pagoId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "subidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagoDocumento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PagoDocumento_pagoId_idx" ON "PagoDocumento"("pagoId");

ALTER TABLE "PagoDocumento" ADD CONSTRAINT "PagoDocumento_pagoId_fkey"
    FOREIGN KEY ("pagoId") REFERENCES "PagoInfluencer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
