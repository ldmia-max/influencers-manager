import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { BriefData } from "@/lib/schemas/brief";

/** Prisma exige InputJsonValue en columnas Json: convierte estructuras tipadas. */
const aJson = (valor: unknown) => valor as Prisma.InputJsonValue;

export interface DocumentoAdjunto {
  nombre: string;
  url: string;
  tamano: number;
  tipo: string;
}

/**
 * Guarda un brief enviado desde el formulario publico.
 * No crea Campaign ni Client: el brief queda en estado PENDIENTE para
 * que el equipo lo revise y despues lo convierta.
 */
export async function createCampaignBrief(
  data: BriefData,
  documentos: DocumentoAdjunto[] = []
) {
  return prisma.campaignBrief.create({
    data: {
      // 01 Datos de contacto
      empresa: data.empresa,
      responsable: data.responsable,
      cargo: data.cargo,
      correo: data.correo,
      telefono: data.telefono,
      apruebaContenidos: data.apruebaContenidos,
      tiempoRespuesta: data.tiempoRespuesta,

      // 02 Resumen de la campana
      nombreCampana: data.nombreCampana,
      descripcionProducto: data.descripcionProducto,
      objetivoPrincipal: data.objetivoPrincipal,
      objetivoOtro: data.objetivoOtro,
      fechaInicio: new Date(data.fechaInicio),
      fechaFinal: new Date(data.fechaFinal),
      fechaPublicacion: new Date(data.fechaPublicacion),
      fechasClave: data.fechasClave,
      presupuestoTotal: data.presupuestoTotal,
      moneda: data.moneda,
      incluyePauta: data.incluyePauta,
      pautaDias: data.pautaDias,
      kpis: data.kpis,
      campanasPrevias: data.campanasPrevias,

      // 03 Producto o servicio
      queSePromociona: data.queSePromociona,
      precioYCompra: data.precioYCompra,
      territorioPromocion: data.territorioPromocion,
      publicoObjetivo: data.publicoObjetivo,
      enviaMuestra: data.enviaMuestra,
      problemaResuelve: data.problemaResuelve,
      atributos: data.atributos.filter(Boolean),
      competidores: data.competidores,

      // 04 Mensajes y comunicacion
      claimsObligatorios: data.claimsObligatorios,
      claimsProhibidos: data.claimsProhibidos,
      libertadCreativa: data.libertadCreativa,
      datosDuros: data.datosDuros,
      temasSensibles: data.temasSensibles,
      tono: data.tono,

      // 05 Enlaces y menciones
      landingUrl: data.landingUrl,
      usuariosEtiquetar: data.usuariosEtiquetar,
      hashtags: data.hashtags,
      appYTienda: data.appYTienda,
      codigoDescuento: data.codigoDescuento,

      // 06 Creadores de contenido
      creadoresSugeridos: aJson(
        data.creadoresSugeridos.filter((c) => c.nombre || c.linkPerfil)
      ),
      nichos: data.nichos,
      plataformas: data.plataformas,
      tamanoAudiencia: data.tamanoAudiencia,
      cantidadCreadores: data.cantidadCreadores,
      ciudadPaisCreador: data.ciudadPaisCreador,
      perfilDemografico: data.perfilDemografico,
      presenciaFisica: data.presenciaFisica,
      creadoresVetados: data.creadoresVetados,
      marcasVetadas: data.marcasVetadas,

      // 07 Condiciones legales y de uso
      colaboracionConMarca: data.colaboracionConMarca,
      etiquetaPublicidad: data.etiquetaPublicidad,
      exclusividad: data.exclusividad,
      permanenciaContenido: data.permanenciaContenido,
      restriccionesLegales: data.restriccionesLegales,

      // 08 Documentos adjuntos
      documentos: documentos.length > 0 ? aJson(documentos) : undefined,

      // 09 Referencias
      referenciasGustan: data.referenciasGustan,
      referenciasNoGustan: data.referenciasNoGustan,
      comentarios: data.comentarios,
    },
    select: { id: true, nombreCampana: true, empresa: true, createdAt: true },
  });
}

export async function getCampaignBriefs(status?: "PENDIENTE" | "REVISADO" | "CONVERTIDO" | "DESCARTADO") {
  return prisma.campaignBrief.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
  });
}

export async function getCampaignBriefById(id: string) {
  return prisma.campaignBrief.findUnique({ where: { id } });
}
