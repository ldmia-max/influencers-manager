import { prisma } from "@/lib/prisma";
import { ValidationError, NotFoundError } from "./errors";
import { calculateServiceTotal } from "@/lib/campaign-utils";
import { estadoDePago, plazoDePago, mesDelPago, type EstadoPago } from "@/lib/pagos";

/**
 * Pagos a influencers.
 *
 * Un pago por influencer y campana. El importe NO se guarda: sale de lo
 * contratado en la campana y se calcula al leer. Guardarlo seria volver
 * a tener dos numeros para lo mismo, que es el problema que este modulo
 * viene a terminar —en las hojas de calculo, el mismo influencer
 * aparecia con 6.366.667 en una y 6.367.000 en la otra—.
 *
 * El importe es el COSTE, sin el margen que se le cobra al cliente:
 * `basePrice`, no el precio con markup. Lo que se le paga al creador es
 * lo que se pacto con el, no lo que factura la agencia.
 *
 * Lo que todavia no hay —impuestos, valor a pagar, abonos y saldo—
 * espera a que mercadeo y contabilidad acuerden la formula. Abrir los
 * abonos antes seria anotar pagos contra una cifra que va a cambiar.
 */

/** Solo las campanas que ya arrancaron tienen trabajo que pagar. */
const ESTADOS_PAGABLES = ["ACTIVE", "COMPLETED", "CANCELLED"] as const;

const SELECCION = {
  id: true,
  profile: {
    select: {
      id: true,
      name: true,
      nombreCompleto: true,
      tipoDocumento: true,
      numeroDocumento: true,
    },
  },
  campaign: {
    select: {
      id: true,
      name: true,
      status: true,
      client: { select: { id: true, companyName: true } },
    },
  },
  platforms: {
    select: { services: { select: { basePrice: true, quantity: true } } },
  },
  pago: {
    select: {
      id: true,
      cuentaCobroUrl: true,
      cuentaCobroNombre: true,
      certificadoUrl: true,
      certificadoNombre: true,
      fechaCuentaCobro: true,
      documento: true,
      observaciones: true,
    },
  },
} as const;

type Fila = Awaited<
  ReturnType<typeof prisma.campaignProfile.findMany<{ select: typeof SELECCION }>>
>[number];

export interface PagoVista {
  campaignProfileId: string;
  influencer: string;
  /** Quien firma y factura, que no siempre es quien sale en camara. */
  nombreCompleto: string | null;
  documentoIdentidad: string | null;
  campanaId: string;
  campana: string;
  clienteId: string;
  cliente: string;
  /** Coste contratado, sin el margen del cliente. */
  base: number;
  estado: EstadoPago;
  cuentaCobroUrl: string | null;
  cuentaCobroNombre: string | null;
  certificadoUrl: string | null;
  certificadoNombre: string | null;
  fechaCuentaCobro: string | null;
  documento: string | null;
  observaciones: string | null;
  /** "YYYY-MM" de la cuenta de cobro. Null mientras no la haya. */
  mes: string | null;
  vence: string | null;
  diasRestantes: number | null;
  vencido: boolean;
}

function aVista(cp: Fila): PagoVista {
  let base = 0;
  for (const plataforma of cp.platforms) {
    for (const servicio of plataforma.services) {
      base += calculateServiceTotal(
        Number(servicio.basePrice),
        servicio.quantity
      ).baseTotal;
    }
  }

  const pago = cp.pago;
  const fecha = pago?.fechaCuentaCobro ?? null;
  const plazo = plazoDePago(fecha);

  return {
    campaignProfileId: cp.id,
    influencer: cp.profile.name,
    nombreCompleto: cp.profile.nombreCompleto,
    documentoIdentidad: cp.profile.numeroDocumento
      ? `${cp.profile.tipoDocumento ?? ""} ${cp.profile.numeroDocumento}`.trim()
      : null,
    campanaId: cp.campaign.id,
    campana: cp.campaign.name,
    clienteId: cp.campaign.client.id,
    cliente: cp.campaign.client.companyName,
    base,
    estado: estadoDePago(
      pago
        ? {
            cuentaCobroUrl: pago.cuentaCobroUrl,
            certificadoUrl: pago.certificadoUrl,
            fechaCuentaCobro: fecha ? fecha.toISOString() : null,
            documento: pago.documento,
          }
        : null
    ),
    cuentaCobroUrl: pago?.cuentaCobroUrl ?? null,
    cuentaCobroNombre: pago?.cuentaCobroNombre ?? null,
    certificadoUrl: pago?.certificadoUrl ?? null,
    certificadoNombre: pago?.certificadoNombre ?? null,
    fechaCuentaCobro: fecha ? fecha.toISOString() : null,
    documento: pago?.documento ?? null,
    observaciones: pago?.observaciones ?? null,
    mes: mesDelPago(fecha),
    vence: plazo?.vence ?? null,
    diasRestantes: plazo?.diasRestantes ?? null,
    vencido: plazo?.vencido ?? false,
  };
}

/**
 * A quien hay que pagar.
 *
 * Solo los aprobados y todavia contratados: quien espera respuesta del
 * cliente no tiene trabajo encargado, y a un retirado se le dejo de
 * contar el importe en la campana, asi que pagarselo aqui diria lo
 * contrario que el total de esa campana.
 */
export async function listarPagos(filtros: {
  campaignId?: string;
  clientId?: string;
  profileId?: string;
  /** "YYYY-MM" sobre la fecha de la cuenta de cobro. */
  mes?: string;
  estado?: EstadoPago;
  /** Solo los que ya pasaron de los 60 dias. */
  soloVencidos?: boolean;
  texto?: string;
}): Promise<PagoVista[]> {
  const filas = await prisma.campaignProfile.findMany({
    where: {
      status: "APPROVED",
      participacion: "ACTIVO",
      campaign: {
        status: { in: [...ESTADOS_PAGABLES] },
        ...(filtros.campaignId && { id: filtros.campaignId }),
        ...(filtros.clientId && { clientId: filtros.clientId }),
      },
      ...(filtros.profileId && { profileId: filtros.profileId }),
      ...(filtros.texto && {
        OR: [
          { profile: { name: { contains: filtros.texto, mode: "insensitive" } } },
          {
            profile: {
              nombreCompleto: { contains: filtros.texto, mode: "insensitive" },
            },
          },
          { campaign: { name: { contains: filtros.texto, mode: "insensitive" } } },
          {
            campaign: {
              client: {
                companyName: { contains: filtros.texto, mode: "insensitive" },
              },
            },
          },
        ],
      }),
    },
    select: SELECCION,
    orderBy: [{ campaign: { createdAt: "desc" } }, { createdAt: "asc" }],
  });

  // El mes, el estado y el vencimiento son calculados, asi que se
  // filtran aqui y no en SQL: son los mismos que se pintan, de modo que
  // la lista y los filtros no pueden discrepar.
  return filas
    .map(aVista)
    .filter((p) => !filtros.mes || p.mes === filtros.mes)
    .filter((p) => !filtros.estado || p.estado === filtros.estado)
    .filter((p) => !filtros.soloVencidos || p.vencido);
}

/** El pago de un influencer en una campana. */
export async function obtenerPago(campaignProfileId: string): Promise<PagoVista> {
  const cp = await prisma.campaignProfile.findUnique({
    where: { id: campaignProfileId },
    select: SELECCION,
  });
  if (!cp) throw new NotFoundError("Influencer no encontrado en la campaña");
  return aVista(cp);
}

/** El registro existe solo cuando alguien aporta el primer dato. */
async function asegurarPago(campaignProfileId: string) {
  const cp = await prisma.campaignProfile.findUnique({
    where: { id: campaignProfileId },
    select: {
      id: true,
      status: true,
      participacion: true,
      campaign: { select: { status: true } },
    },
  });
  if (!cp) throw new NotFoundError("Influencer no encontrado en la campaña");

  if (!ESTADOS_PAGABLES.includes(cp.campaign.status as (typeof ESTADOS_PAGABLES)[number])) {
    throw new ValidationError(
      "La campaña todavía no ha arrancado: no hay trabajo que pagar."
    );
  }
  if (cp.status !== "APPROVED" || cp.participacion !== "ACTIVO") {
    throw new ValidationError(
      "Solo se paga a quien el cliente aprobó y sigue contratado."
    );
  }
  return cp.id;
}

/**
 * Lo que aporta mercadeo: los documentos y la fecha de la cuenta de
 * cobro, que es el dia desde el que corre el plazo.
 */
export async function guardarDocumentacionDePago(
  campaignProfileId: string,
  datos: {
    cuentaCobro?: { url: string; nombre: string } | null;
    certificado?: { url: string; nombre: string } | null;
    fechaCuentaCobro?: Date | null;
    observaciones?: string | null;
  }
) {
  await asegurarPago(campaignProfileId);

  const campos = {
    ...(datos.cuentaCobro !== undefined && {
      cuentaCobroUrl: datos.cuentaCobro?.url ?? null,
      cuentaCobroNombre: datos.cuentaCobro?.nombre ?? null,
    }),
    ...(datos.certificado !== undefined && {
      certificadoUrl: datos.certificado?.url ?? null,
      certificadoNombre: datos.certificado?.nombre ?? null,
    }),
    ...(datos.fechaCuentaCobro !== undefined && {
      fechaCuentaCobro: datos.fechaCuentaCobro,
    }),
    ...(datos.observaciones !== undefined && {
      observaciones: datos.observaciones?.trim() || null,
    }),
  };

  await prisma.pagoInfluencer.upsert({
    where: { campaignProfileId },
    create: { campaignProfileId, ...campos },
    update: campos,
  });

  return obtenerPago(campaignProfileId);
}

/**
 * Lo que anota contabilidad: el consecutivo de su sistema.
 *
 * Va aparte de la documentacion y no en una funcion generica: asi la
 * capa de datos distingue por si sola quien puede tocar que, sin
 * confiar en que la pantalla esconda el campo correcto.
 */
export async function registrarPagoEnContabilidad(
  campaignProfileId: string,
  datos: { documento?: string | null; fechaCuentaCobro?: Date | null }
) {
  await asegurarPago(campaignProfileId);

  const pago = await prisma.pagoInfluencer.findUnique({
    where: { campaignProfileId },
    select: { cuentaCobroUrl: true, certificadoUrl: true, fechaCuentaCobro: true },
  });

  const documento = datos.documento?.trim() || null;
  if (documento) {
    // Registrar es tomar por bueno lo que mando mercadeo. Sin la cuenta
    // de cobro no hay nada que registrar, y sin su fecha el plazo de 60
    // dias no empieza a correr: quedaria un pago sin vencimiento.
    if (!pago?.cuentaCobroUrl) {
      throw new ValidationError(
        "Falta la cuenta de cobro: mercadeo tiene que subirla antes."
      );
    }
    const fecha = datos.fechaCuentaCobro ?? pago.fechaCuentaCobro;
    if (!fecha) {
      throw new ValidationError(
        "Falta la fecha de la cuenta de cobro: desde ella corren los 60 días."
      );
    }
  }

  await prisma.pagoInfluencer.upsert({
    where: { campaignProfileId },
    create: {
      campaignProfileId,
      documento,
      ...(datos.fechaCuentaCobro !== undefined && {
        fechaCuentaCobro: datos.fechaCuentaCobro,
      }),
    },
    update: {
      ...(datos.documento !== undefined && { documento }),
      ...(datos.fechaCuentaCobro !== undefined && {
        fechaCuentaCobro: datos.fechaCuentaCobro,
      }),
    },
  });

  return obtenerPago(campaignProfileId);
}
