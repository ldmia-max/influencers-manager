/**
 * Formatea un numero con separadores de miles usando "."
 * Ejemplo: 1000 -> "1.000", 1000000 -> "1.000.000"
 */
export function formatNumber(value: string | number): string {
  // Convertir a string y remover cualquier caracter que no sea numero
  const numericValue = String(value).replace(/\D/g, "");

  if (!numericValue) return "";

  // Agregar separadores de miles
  return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Parsea un numero formateado a un numero entero
 * Ejemplo: "1.000" -> 1000, "1.000.000" -> 1000000
 */
export function parseFormattedNumber(value: string): number {
  const numericValue = value.replace(/\D/g, "");
  return numericValue ? parseInt(numericValue, 10) : 0;
}

/**
 * Extrae solo los digitos de un string
 */
export function extractDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export interface ReachRangeData {
  minFollowers: number;
  maxFollowers: number | null;
  reachPercentage: number;
}

/**
 * Calcula el alcance estimado basado en el número de seguidores.
 * Si se pasan rangos de la BD, los usa; sino usa valores por defecto:
 * - Menos de 100,000 seguidores: 40% de alcance
 * - Entre 100,000 y 500,000 seguidores: 30% de alcance
 * - Mayor a 500,000 seguidores: 20% de alcance
 */
export function calculateReach(followers: number | null, reachRanges?: ReachRangeData[]): number | null {
  if (followers === null || followers === 0) return null;

  const percentage = getReachPercentage(followers, reachRanges);
  if (percentage === null) return null;

  return Math.round(followers * (percentage / 100));
}

/**
 * Obtiene el porcentaje de alcance basado en el número de seguidores.
 * Si se pasan rangos de la BD, los usa; sino usa valores por defecto.
 */
export function getReachPercentage(followers: number | null, reachRanges?: ReachRangeData[]): number | null {
  if (followers === null || followers === 0) return null;

  if (reachRanges && reachRanges.length > 0) {
    for (const range of reachRanges) {
      const inMin = followers >= range.minFollowers;
      const inMax = range.maxFollowers === null || followers <= range.maxFollowers;
      if (inMin && inMax) {
        // Normalize: if stored as decimal (0.40) convert to percentage (40)
        return range.reachPercentage <= 1 ? range.reachPercentage * 100 : range.reachPercentage;
      }
    }
    // No matching range: use the closest range (last one sorted by minFollowers)
    // This covers profiles with more followers than the highest defined range
    const sorted = [...reachRanges].sort((a, b) => a.minFollowers - b.minFollowers);
    const lastRange = sorted[sorted.length - 1];
    if (followers > lastRange.minFollowers) {
      return lastRange.reachPercentage <= 1 ? lastRange.reachPercentage * 100 : lastRange.reachPercentage;
    }
  }

  // Default hardcoded values (fallback when no ranges exist)
  if (followers < 100000) {
    return 40;
  } else if (followers <= 500000) {
    return 30;
  } else {
    return 20;
  }
}

/**
 * Formatea un número de forma compacta (ej: 70K, 1.5M)
 * - Menos de 1,000: muestra el número completo
 * - 1,000 - 999,999: muestra en K (ej: 70.5K)
 * - 1,000,000+: muestra en M (ej: 1.5M)
 */
export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return "0";

  if (value < 1000) {
    return value.toString();
  } else if (value < 1000000) {
    const k = value / 1000;
    // Si es un número redondo, no mostrar decimales
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(1).replace(/\.0$/, "")}K`;
  } else {
    const m = value / 1000000;
    return m % 1 === 0 ? `${m}M` : `${m.toFixed(1).replace(/\.0$/, "")}M`;
  }
}
