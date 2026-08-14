-- CreateEnum
CREATE TYPE "BriefStatus" AS ENUM ('PENDIENTE', 'REVISADO', 'CONVERTIDO', 'DESCARTADO');

-- AlterTable
ALTER TABLE "CampaignService" ADD COLUMN     "clientNotes" TEXT;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "CampaignBrief" (
    "id" TEXT NOT NULL,
    "status" "BriefStatus" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "empresa" TEXT NOT NULL,
    "responsable" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "apruebaContenidos" TEXT,
    "tiempoRespuesta" TEXT,
    "nombreCampana" TEXT NOT NULL,
    "descripcionProducto" TEXT NOT NULL,
    "objetivoPrincipal" TEXT NOT NULL,
    "objetivoOtro" TEXT,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFinal" TIMESTAMP(3) NOT NULL,
    "fechaPublicacion" TIMESTAMP(3) NOT NULL,
    "fechasClave" TEXT NOT NULL,
    "presupuestoTotal" DECIMAL(12,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'COP',
    "incluyePauta" TEXT NOT NULL,
    "pautaDias" INTEGER,
    "kpis" TEXT,
    "campanasPrevias" TEXT,
    "queSePromociona" TEXT[],
    "precioYCompra" TEXT NOT NULL,
    "territorioPromocion" TEXT NOT NULL,
    "publicoObjetivo" TEXT NOT NULL,
    "enviaMuestra" TEXT,
    "problemaResuelve" TEXT,
    "atributos" TEXT[],
    "competidores" TEXT,
    "claimsObligatorios" TEXT NOT NULL,
    "claimsProhibidos" TEXT NOT NULL,
    "libertadCreativa" TEXT NOT NULL,
    "datosDuros" TEXT,
    "temasSensibles" TEXT,
    "tono" TEXT[],
    "landingUrl" TEXT,
    "usuariosEtiquetar" TEXT NOT NULL,
    "hashtags" TEXT,
    "appYTienda" TEXT,
    "codigoDescuento" TEXT,
    "creadoresSugeridos" JSONB,
    "nichos" TEXT[],
    "plataformas" TEXT[],
    "tamanoAudiencia" TEXT,
    "cantidadCreadores" TEXT,
    "ciudadPaisCreador" TEXT,
    "perfilDemografico" TEXT,
    "presenciaFisica" TEXT,
    "creadoresVetados" TEXT,
    "marcasVetadas" TEXT,
    "colaboracionConMarca" TEXT NOT NULL,
    "etiquetaPublicidad" TEXT[],
    "exclusividad" TEXT,
    "permanenciaContenido" TEXT,
    "restriccionesLegales" TEXT,
    "documentos" JSONB,
    "referenciasGustan" TEXT,
    "referenciasNoGustan" TEXT,
    "comentarios" TEXT,
    "campaignId" TEXT,

    CONSTRAINT "CampaignBrief_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignBrief_status_createdAt_idx" ON "CampaignBrief"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "CampaignBrief" ADD CONSTRAINT "CampaignBrief_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

