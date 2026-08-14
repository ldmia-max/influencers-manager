import { Decimal } from "@prisma/client/runtime/library";

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
 * Calcula el precio con markup del 20%
 */
export function calculateMarkupPrice(basePrice: number | Decimal): number {
  const price = typeof basePrice === "number" ? basePrice : Number(basePrice);
  return price * (1 + MARKUP_PERCENTAGE);
}

/**
 * Calcula los totales de un servicio
 */
export function calculateServiceTotal(
  basePrice: number | Decimal,
  quantity: number
): {
  baseTotal: number;
  markupTotal: number;
} {
  const price = typeof basePrice === "number" ? basePrice : Number(basePrice);
  const baseTotal = price * quantity;
  const markupTotal = calculateMarkupPrice(price) * quantity;
  return { baseTotal, markupTotal };
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
