import { prisma } from "@/lib/prisma";
import { ValidationError, NotFoundError } from "./errors";
import { calculateServiceTotal, MARKUP_PERCENTAGE } from "@/lib/campaign-utils";
import {
  calcularImpuestos,
  estadoDePago,
  hipotesis,
  mesDelPago,
  plazoDePago,
  reservaMaxima,
  utilidadDe,
  type EstadoPago,
  type Impuestos,
  type TipoPersona,
} from "@/lib/pagos";

/**
 * Pagos a influencers.
 *
 * Un pago por influencer y campana, con abonos parciales. Lo que NO se
 * guarda, a proposito:
 *
 * - El importe base. Sale de lo contratado en la campana. Guardarlo
 *   seria volver a tener dos numeros para lo mismo, que es el problema
 *   de partida: el mismo influencer aparecia con 6.366.667 en la hoja
 *   de mercadeo y 6.367.000 en la de contabilidad.
 * - Los impuestos. Salen de la base y del tipo de persona. En la hoja
 *   hay filas con la retencion en blanco no porque no aplique, sino
 *   porque se olvido teclearla; calculada, no se puede olvidar.
 * - El estado y el saldo. Se deducen de los documentos y los abonos.
 *
 * El importe es el COSTE —basePrice—, no el precio con el margen que se
 * le cobra al cliente: al creador se le paga lo que se pacto con el.
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
      tipoPersona: true,
      tipoPersonaVerificado: true,
    },
  },
  campaign: {
    select: {
      id: true,
      name: true,
      status: true,
      budget: true,
      markupPercentage: true,
      startDate: true,
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
      rutUrl: true,
      rutNombre: true,
      arlUrl: true,
      arlNombre: true,
      fechaCuentaCobro: true,
      tipoPersona: true,
      documento: true,
      fechaDocumento: true,
      ajuste: true,
      motivoAjuste: true,
      loPagaElCliente: true,
      observaciones: true,
      abonos: {
        orderBy: { fecha: "asc" as const },
        select: {
          id: true,
          fecha: true,
          valor: true,
          observacion: true,
          registradoPor: { select: { name: true } },
        },
      },
    },
  },
} as const;

type Fila = Awaited<
  ReturnType<typeof prisma.campaignProfile.findMany<{ select: typeof SELECCION }>>
>[number];

export interface AbonoVista {
  id: string;
  fecha: string;
  valor: number;
  observacion: string | null;
  registradoPor: string | null;
}

export interface PagoVista {
  campaignProfileId: string;
  influencer: string;
  nombreCompleto: string | null;
  documentoIdentidad: string | null;
  campanaId: string;
  campana: string;
  clienteId: string;
  cliente: string;
  /** "YYYY-MM" del arranque de la campana, para filtrar por mes. */
  mesCampana: string | null;

  /** Coste contratado, sin el margen. Es lo que contabilidad paga. */
  base: number;
  /**
   * Lo que ve el cliente: base + 40%. Es lo que descuenta del
   * presupuesto de la campana, no el coste.
   */
  precioCliente: number;
  /** Lo que se queda la agencia de este influencer. */
  utilidad: number;
  /** Con el que se calculo. Null mientras no se sepa. */
  tipoPersona: TipoPersona | null;
  /** True si se confirmo mirando el RUT del influencer. */
  tipoVerificado: boolean;
  /** Los importes, cuando se sabe el tipo. */
  impuestos: Impuestos | null;
  /** Las dos cifras posibles, mientras no se sepa. */
  hipotesis: Record<TipoPersona, Impuestos> | null;
  /** Lo que hay que reservar de presupuesto: lo real o el peor caso. */
  reserva: number;

  ajuste: number;
  motivoAjuste: string | null;
  abonos: AbonoVista[];
  abonado: number;
  /** Lo que falta por pagar: a pagar + ajuste − abonado. */
  saldo: number;

  estado: EstadoPago;
  loPagaElCliente: boolean;

  cuentaCobroUrl: string | null;
  cuentaCobroNombre: string | null;
  certificadoUrl: string | null;
  certificadoNombre: string | null;
  rutUrl: string | null;
  rutNombre: string | null;
  arlUrl: string | null;
  arlNombre: string | null;

  fechaCuentaCobro: string | null;
  documento: string | null;
  fechaDocumento: string | null;
  observaciones: string | null;

  /** Dias transcurridos desde la cuenta de cobro, hacia arriba. */
  dias: number | null;
  vence: string | null;
  avisar: boolean;
  vencido: boolean;
}

export interface GrupoDeCampana {
  campanaId: string;
  campana: string;
  cliente: string;
  mes: string | null;
  presupuesto: number;
  /**
   * Lo que se lleva consumido del presupuesto: la suma de los precios
   * que ve el cliente, base + margen. No el coste: el presupuesto se
   * mide contra lo que se le cobra.
   */
  consumido: number;
  disponible: number;
  /** Coste de los influencers, sin margen. */
  coste: number;
  /** Lo que de verdad hay que girarles, con sus impuestos. */
  aPagar: number;
  /** Lo que se queda la agencia. Interno: nunca sale de la agencia. */
  utilidad: number;
  /** Suma de saldos: lo que esta campana todavia pide. */
  saldo: number;
  /**
   * Lo que hay que pagar supera el presupuesto.
   *
   * No deberia ocurrir nunca —el presupuesto cubre base + 40% y el pago
   * es como mucho base + 19%— asi que si pasa es que algo se contrato
   * fuera de cuenta, y conviene que salte a la vista.
   */
  excedido: boolean;
  pagos: PagoVista[];
}

function aVista(cp: Fila): PagoVista {
  // Dos cifras distintas y las dos hacen falta: la base es lo que se le
  // paga al influencer; la base mas el margen es lo que ve el cliente y
  // lo que descuenta del presupuesto de la campana.
  const margen = cp.campaign.markupPercentage ?? MARKUP_PERCENTAGE;
  let base = 0;
  let precioCliente = 0;
  for (const plataforma of cp.platforms) {
    for (const servicio of plataforma.services) {
      const totales = calculateServiceTotal(
        Number(servicio.basePrice),
        servicio.quantity,
        margen
      );
      base += totales.baseTotal;
      precioCliente += totales.markupTotal;
    }
  }

  const pago = cp.pago;
  const fecha = pago?.fechaCuentaCobro ?? null;
  const plazo = plazoDePago(fecha);

  // El tipo congelado en el pago manda sobre el del perfil: corregir el
  // perfil no debe cambiar solo un pago ya calculado.
  const tipo = (pago?.tipoPersona ?? cp.profile.tipoPersona ?? null) as
    | TipoPersona
    | null;
  const impuestos = tipo ? calcularImpuestos(base, tipo) : null;

  const ajuste = pago?.ajuste ? Number(pago.ajuste) : 0;
  const abonos: AbonoVista[] = (pago?.abonos ?? []).map((a) => ({
    id: a.id,
    fecha: a.fecha.toISOString(),
    valor: Number(a.valor),
    observacion: a.observacion,
    registradoPor: a.registradoPor?.name ?? null,
  }));
  const abonado = abonos.reduce((s, a) => s + a.valor, 0);

  // Mientras no se sepa el tipo, el saldo se calcula sobre el peor
  // caso: es lo que hay que tener reservado, no una promesa.
  const aPagar = impuestos?.valorAPagar ?? reservaMaxima(base);
  const saldo = Math.max(aPagar + ajuste - abonado, 0);

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
    mesCampana: mesDelPago(cp.campaign.startDate),

    base,
    precioCliente,
    utilidad: utilidadDe(base, tipo),
    tipoPersona: tipo,
    tipoVerificado: cp.profile.tipoPersonaVerificado,
    impuestos,
    hipotesis: tipo ? null : hipotesis(base),
    reserva: impuestos?.valorFactura ?? reservaMaxima(base),

    ajuste,
    motivoAjuste: pago?.motivoAjuste ?? null,
    abonos,
    abonado,
    saldo,

    estado: estadoDePago(
      pago
        ? {
            cuentaCobroUrl: pago.cuentaCobroUrl,
            certificadoUrl: pago.certificadoUrl,
            documento: pago.documento,
            loPagaElCliente: pago.loPagaElCliente,
            saldo,
            abonado,
          }
        : null
    ),
    loPagaElCliente: pago?.loPagaElCliente ?? false,

    cuentaCobroUrl: pago?.cuentaCobroUrl ?? null,
    cuentaCobroNombre: pago?.cuentaCobroNombre ?? null,
    certificadoUrl: pago?.certificadoUrl ?? null,
    certificadoNombre: pago?.certificadoNombre ?? null,
    rutUrl: pago?.rutUrl ?? null,
    rutNombre: pago?.rutNombre ?? null,
    arlUrl: pago?.arlUrl ?? null,
    arlNombre: pago?.arlNombre ?? null,

    fechaCuentaCobro: fecha ? fecha.toISOString() : null,
    documento: pago?.documento ?? null,
    fechaDocumento: pago?.fechaDocumento
      ? pago.fechaDocumento.toISOString()
      : null,
    observaciones: pago?.observaciones ?? null,

    dias: plazo?.dias ?? null,
    vence: plazo?.vence ?? null,
    avisar: plazo?.avisar ?? false,
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
  /** "YYYY-MM" sobre el arranque de la campana. */
  mes?: string;
  estado?: EstadoPago;
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
    .filter((p) => !filtros.mes || p.mesCampana === filtros.mes)
    .filter((p) => !filtros.estado || p.estado === filtros.estado)
    .filter((p) => !filtros.soloVencidos || p.vencido);
}

/**
 * Los pagos agrupados por campana, que es como contabilidad mira su
 * trabajo: cada cuadro de su hoja es una campana, y el total de saldos
 * se compara con el presupuesto para no pasarse.
 *
 * Dentro de cada grupo, lo mas urgente arriba: mas dias transcurridos
 * primero, y lo que aun no tiene cuenta de cobro al final.
 */
export function agruparPorCampana(pagos: PagoVista[]): GrupoDeCampana[] {
  const grupos = new Map<string, PagoVista[]>();
  for (const p of pagos) {
    grupos.set(p.campanaId, [...(grupos.get(p.campanaId) ?? []), p]);
  }

  return [...grupos.values()]
    .map((filas) => {
      const primera = filas[0];
      return {
        campanaId: primera.campanaId,
        campana: primera.campana,
        cliente: primera.cliente,
        mes: primera.mesCampana,
        presupuesto: 0,
        consumido: filas.reduce((s, p) => s + p.precioCliente, 0),
        disponible: 0,
        coste: filas.reduce((s, p) => s + p.base, 0),
        aPagar: filas.reduce(
          (s, p) => s + (p.impuestos?.valorAPagar ?? p.reserva) + p.ajuste,
          0
        ),
        utilidad: filas.reduce((s, p) => s + p.utilidad, 0),
        saldo: filas.reduce((s, p) => s + p.saldo, 0),
        excedido: false,
        pagos: filas.sort((a, b) => (b.dias ?? -1) - (a.dias ?? -1)),
      };
    })
    .sort((a, b) => b.saldo - a.saldo);
}

/** El presupuesto de cada campana, para el encabezado de su grupo. */
export async function presupuestosDeCampanas(
  campaignIds: string[]
): Promise<Map<string, number>> {
  if (campaignIds.length === 0) return new Map();
  const campanas = await prisma.campaign.findMany({
    where: { id: { in: campaignIds } },
    select: { id: true, budget: true },
  });
  return new Map(campanas.map((c) => [c.id, Number(c.budget)]));
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
      profileId: true,
      status: true,
      participacion: true,
      campaign: { select: { status: true } },
    },
  });
  if (!cp) throw new NotFoundError("Influencer no encontrado en la campaña");

  if (
    !ESTADOS_PAGABLES.includes(
      cp.campaign.status as (typeof ESTADOS_PAGABLES)[number]
    )
  ) {
    throw new ValidationError(
      "La campaña todavía no ha arrancado: no hay trabajo que pagar."
    );
  }
  if (cp.status !== "APPROVED" || cp.participacion !== "ACTIVO") {
    throw new ValidationError(
      "Solo se paga a quien el cliente aprobó y sigue contratado."
    );
  }
  return cp;
}

/**
 * Lo que aporta mercadeo: los tres documentos, la fecha de la cuenta de
 * cobro y el tipo de persona que se pacto al negociar.
 */
export async function guardarDocumentacionDePago(
  campaignProfileId: string,
  datos: {
    cuentaCobro?: { url: string; nombre: string } | null;
    certificado?: { url: string; nombre: string } | null;
    rut?: { url: string; nombre: string } | null;
    arl?: { url: string; nombre: string } | null;
    fechaCuentaCobro?: Date | null;
    tipoPersona?: TipoPersona | null;
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
    ...(datos.rut !== undefined && {
      rutUrl: datos.rut?.url ?? null,
      rutNombre: datos.rut?.nombre ?? null,
    }),
    ...(datos.arl !== undefined && {
      arlUrl: datos.arl?.url ?? null,
      arlNombre: datos.arl?.nombre ?? null,
    }),
    ...(datos.fechaCuentaCobro !== undefined && {
      fechaCuentaCobro: datos.fechaCuentaCobro,
    }),
    ...(datos.tipoPersona !== undefined && { tipoPersona: datos.tipoPersona }),
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
 * Lo que anota contabilidad.
 *
 * Va aparte de la documentacion y no en una funcion generica: asi la
 * capa de datos distingue por si sola quien puede tocar que, sin
 * confiar en que la pantalla esconda el campo correcto.
 *
 * Confirmar el tipo de persona aqui lo marca ademas como verificado en
 * el perfil: contabilidad lo comprueba mirando el RUT, y una vez visto
 * no hay que volver a pedirlo en la siguiente campana.
 */
export async function registrarPagoEnContabilidad(
  campaignProfileId: string,
  datos: {
    documento?: string | null;
    fechaDocumento?: Date | null;
    fechaCuentaCobro?: Date | null;
    tipoPersona?: TipoPersona | null;
    ajuste?: number | null;
    motivoAjuste?: string | null;
    loPagaElCliente?: boolean;
  }
) {
  const cp = await asegurarPago(campaignProfileId);

  const pago = await prisma.pagoInfluencer.findUnique({
    where: { campaignProfileId },
    select: {
      cuentaCobroUrl: true,
      fechaCuentaCobro: true,
      loPagaElCliente: true,
    },
  });

  const documento = datos.documento?.trim() || null;
  const loPagaElCliente = datos.loPagaElCliente ?? pago?.loPagaElCliente ?? false;

  if (documento && !loPagaElCliente) {
    // Registrar es tomar por bueno lo que mando mercadeo. Sin la cuenta
    // de cobro no hay nada que registrar, y sin su fecha el plazo de 60
    // dias no empieza a correr: quedaria un pago sin vencimiento.
    if (!pago?.cuentaCobroUrl) {
      throw new ValidationError(
        "Falta la cuenta de cobro: mercadeo tiene que subirla antes."
      );
    }
    if (!(datos.fechaCuentaCobro ?? pago.fechaCuentaCobro)) {
      throw new ValidationError(
        "Falta la fecha de la cuenta de cobro: desde ella corren los 60 días."
      );
    }
  }

  if (datos.ajuste != null && !Number.isFinite(datos.ajuste)) {
    throw new ValidationError("El ajuste debe ser un número");
  }
  // Un ajuste sin razon es un descuadre que nadie sabra explicar dentro
  // de tres meses. En la hoja el comentario va pegado al numero.
  if (datos.ajuste != null && datos.ajuste !== 0 && !datos.motivoAjuste?.trim()) {
    throw new ValidationError("Explica el motivo del ajuste");
  }

  const campos = {
    ...(datos.documento !== undefined && { documento }),
    ...(datos.fechaDocumento !== undefined && {
      fechaDocumento: datos.fechaDocumento,
    }),
    ...(datos.fechaCuentaCobro !== undefined && {
      fechaCuentaCobro: datos.fechaCuentaCobro,
    }),
    ...(datos.tipoPersona !== undefined && { tipoPersona: datos.tipoPersona }),
    ...(datos.ajuste !== undefined && { ajuste: datos.ajuste }),
    ...(datos.motivoAjuste !== undefined && {
      motivoAjuste: datos.motivoAjuste?.trim() || null,
    }),
    ...(datos.loPagaElCliente !== undefined && {
      loPagaElCliente: datos.loPagaElCliente,
    }),
  };

  await prisma.pagoInfluencer.upsert({
    where: { campaignProfileId },
    create: { campaignProfileId, ...campos },
    update: campos,
  });

  // Confirmar el tipo lo deja verificado en el perfil: contabilidad lo
  // comprueba con el RUT, y en la siguiente campana ya no hay que pedirlo.
  if (datos.tipoPersona) {
    await prisma.profile.update({
      where: { id: cp.profileId },
      data: { tipoPersona: datos.tipoPersona, tipoPersonaVerificado: true },
    });
  }

  return obtenerPago(campaignProfileId);
}

/** Un abono contra el pago. El saldo baja con cada uno. */
export async function registrarAbono(
  campaignProfileId: string,
  datos: { fecha: Date; valor: number; observacion?: string | null },
  usuarioId: string
) {
  await asegurarPago(campaignProfileId);

  if (!Number.isFinite(datos.valor) || datos.valor <= 0) {
    throw new ValidationError("El valor del abono debe ser mayor que cero");
  }

  // El pago tiene que existir: se abona contra algo registrado, no
  // contra un influencer del que todavia no se sabe nada.
  const pago = await prisma.pagoInfluencer.findUnique({
    where: { campaignProfileId },
    select: { id: true },
  });
  if (!pago) {
    throw new ValidationError(
      "Este pago todavía no está registrado: no hay contra qué abonar."
    );
  }

  await prisma.abonoPago.create({
    data: {
      pagoId: pago.id,
      fecha: datos.fecha,
      valor: datos.valor,
      observacion: datos.observacion?.trim() || null,
      registradoPorId: usuarioId,
    },
  });

  return obtenerPago(campaignProfileId);
}

/** Deshace un abono mal anotado. */
export async function eliminarAbono(campaignProfileId: string, abonoId: string) {
  await asegurarPago(campaignProfileId);

  const abono = await prisma.abonoPago.findUnique({
    where: { id: abonoId },
    select: { pago: { select: { campaignProfileId: true } } },
  });
  if (!abono) throw new NotFoundError("Abono no encontrado");
  // Que el abono sea de ESTE pago, y no de otro cuyo id alguien adivino.
  if (abono.pago.campaignProfileId !== campaignProfileId) {
    throw new ValidationError("Ese abono no pertenece a este pago");
  }

  await prisma.abonoPago.delete({ where: { id: abonoId } });
  return obtenerPago(campaignProfileId);
}
