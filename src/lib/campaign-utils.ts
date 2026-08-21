import { Decimal } from "@prisma/client/runtime/library";

/**
 * Margen POR DEFECTO para las campanas nuevas.
 *
 * Ya no es el margen de todas: cada campana congela el suyo en
 * Campaign.markupPercentage al crearse. Cambiar este valor solo afecta
 * a las que se creen a partir de entonces, que es lo que permite
 * actualizarlo cada ano sin repreciar lo ya negociado.
 */
export const MARKUP_PERCENTAGE = 0.4; // 40%

export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  REVIEW: "En Revisión",
  PENDING: "Pendiente",
  ACTIVE: "Activa",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

export const CAMPAIGN_STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  DRAFT: "secondary",
  REVIEW: "default",
  PENDING: "outline",
  ACTIVE: "default",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
};

export const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  REVIEW: "bg-blue-100 text-blue-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  ACTIVE: "bg-green-100 text-green-800",
  COMPLETED: "bg-purple-100 text-purple-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export const PROFILE_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
};

export const PROFILE_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

// Transiciones válidas para el usuario
export const USER_VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["REVIEW", "ACTIVE"], // ACTIVE directo para campañas ya negociadas
  REVIEW: ["DRAFT", "ACTIVE"], // Volver a borrador o activar si todos aprobados
  PENDING: ["REVIEW", "CANCELLED"], // Reenviar a revisión o cancelar
  ACTIVE: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/**
 * Aplica un margen al precio base.
 *
 * Es el UNICO sitio donde debe aplicarse. Hubo tres lugares que lo
 * multiplicaban por 1.2 a mano y quedaron desfasados al subirlo al 40%.
 *
 * SIEMPRE que exista una campana hay que pasarle su
 * campaign.markupPercentage. Omitir el argumento usa el margen por
 * defecto, y eso solo es correcto ANTES de que exista la campana: el
 * carrito y el asistente, que trabajan sobre precios sueltos.
 *
 * Aplicarlo sobre un total es equivalente a aplicarlo servicio a
 * servicio y sumar, asi que sirve para ambos usos.
 */
export function calculateMarkupPrice(
  basePrice: number | Decimal,
  markup: number = MARKUP_PERCENTAGE
): number {
  const price = typeof basePrice === "number" ? basePrice : Number(basePrice);
  return price * (1 + markup);
}

/**
 * Calcula los totales de un servicio
 */
export function calculateServiceTotal(
  basePrice: number | Decimal,
  quantity: number,
  markup: number = MARKUP_PERCENTAGE
): {
  baseTotal: number;
  markupTotal: number;
} {
  const price = typeof basePrice === "number" ? basePrice : Number(basePrice);
  const baseTotal = price * quantity;
  const markupTotal = calculateMarkupPrice(price, markup) * quantity;
  return { baseTotal, markupTotal };
}

// =============================================================================
// Total de una campana ya guardada
// =============================================================================

/**
 * Forma minima que necesita el calculo. Se declara con lo justo para que
 * sirva tanto a una consulta completa como a un `select` reducido.
 */
export interface PerfilFacturable {
  participacion: string;
  platforms: {
    services: { basePrice: number | Decimal | string; quantity: number }[];
  }[];
}

/**
 * Suma lo que cuesta una campana YA GUARDADA.
 *
 * Existe porque este calculo estaba repetido en el listado, en la ficha y
 * en el portal de aprobacion, y ahora tiene una regla que es facil de
 * olvidar en uno de esos sitios: **los influencers retirados no suman**.
 * Si un sitio la aplicara y otro no, el presupuesto que ve el cliente no
 * cuadraria con el que ve la agencia. Ya paso algo asi con el margen, que
 * estaba duplicado en tres ficheros.
 *
 * Cuenta aparte lo retirado, porque esa cifra es justo la que interesa al
 * reasignar: es el presupuesto que ha quedado libre.
 *
 * No sirve para el carrito ni para el asistente de campanas: alli se
 * manejan selecciones que todavia no existen en base de datos y no tienen
 * participacion. Para eso esta calculateSelectionTotal.
 */
export function calcularTotalCampana(
  perfiles: PerfilFacturable[],
  markup: number = MARKUP_PERCENTAGE
): {
  /** Coste para la agencia, sin margen, solo de los activos. */
  base: number;
  /** Lo que paga el cliente, con margen, solo de los activos. */
  conMargen: number;
  /** Lo que sumarian los retirados: el presupuesto liberado. */
  liberado: number;
  perfilesActivos: number;
  perfilesRetirados: number;
} {
  let base = 0;
  let conMargen = 0;
  let liberado = 0;
  let perfilesActivos = 0;
  let perfilesRetirados = 0;

  for (const perfil of perfiles) {
    const activo = perfil.participacion === "ACTIVO";
    if (activo) perfilesActivos++;
    else perfilesRetirados++;

    for (const plataforma of perfil.platforms) {
      for (const servicio of plataforma.services) {
        const { baseTotal, markupTotal } = calculateServiceTotal(
          Number(servicio.basePrice),
          servicio.quantity,
          markup
        );
        if (activo) {
          base += baseTotal;
          conMargen += markupTotal;
        } else {
          liberado += markupTotal;
        }
      }
    }
  }

  return { base, conMargen, liberado, perfilesActivos, perfilesRetirados };
}

/**
 * Valida si el total con markup no excede el presupuesto
 */
export function validateBudget(
  totalWithMarkup: number,
  budget: number | Decimal
): boolean {
  const budgetNum = typeof budget === "number" ? budget : Number(budget);
  return totalWithMarkup <= budgetNum;
}

/**
 * Calcula el presupuesto restante
 */
export function calculateRemainingBudget(
  budget: number | Decimal,
  totalWithMarkup: number
): number {
  const budgetNum = typeof budget === "number" ? budget : Number(budget);
  return budgetNum - totalWithMarkup;
}

/**
 * Calcula el porcentaje de presupuesto utilizado
 */
export function calculateBudgetPercentage(
  totalWithMarkup: number,
  budget: number | Decimal
): number {
  const budgetNum = typeof budget === "number" ? budget : Number(budget);
  if (budgetNum === 0) return 0;
  return (totalWithMarkup / budgetNum) * 100;
}

export interface ServiceSelection {
  profileServiceId: string;
  quantity: number;
  basePrice: number;
}

export interface PlatformSelection {
  socialAccountId: string;
  services: ServiceSelection[];
}

export interface ProfileSelection {
  profileId: string;
  platforms: PlatformSelection[];
}

/**
 * Calcula el total de una selección de perfiles/plataformas/servicios
 */
export function calculateSelectionTotal(profiles: ProfileSelection[]): {
  baseTotal: number;
  markupTotal: number;
} {
  let baseTotal = 0;
  let markupTotal = 0;

  profiles.forEach((profile) => {
    profile.platforms.forEach((platform) => {
      platform.services.forEach((service) => {
        const { baseTotal: sBase, markupTotal: sMarkup } = calculateServiceTotal(
          service.basePrice,
          service.quantity
        );
        baseTotal += sBase;
        markupTotal += sMarkup;
      });
    });
  });

  return { baseTotal, markupTotal };
}
