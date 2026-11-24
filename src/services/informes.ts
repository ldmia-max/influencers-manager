import { apiPut } from "./api";
import type { Analisis } from "@/lib/informe/tipos";

/** Guarda el analisis reescrito; null en un apartado vuelve a la propuesta. */
export function guardarAnalisisInforme(
  campaignId: string,
  analisis: Record<keyof Analisis, string | null>,
) {
  return apiPut<{ analisis: Partial<Analisis> }>(
    `/api/campaigns/${campaignId}/informe/analisis`,
    analisis,
  );
}

/**
 * Descarga el PowerPoint. Se pide con fetch y no con un enlace para
 * poder decir que fallo: un enlace abriria el JSON del error en una
 * pestana nueva.
 */
export async function descargarInforme(campaignId: string): Promise<{
  archivo: Blob;
  nombre: string;
}> {
  const r = await fetch(`/api/campaigns/${campaignId}/informe`);
  if (!r.ok) {
    const cuerpo = await r.json().catch(() => null);
    throw new Error(cuerpo?.error ?? "No se pudo generar el informe");
  }
  const disposicion = r.headers.get("Content-Disposition") ?? "";
  const utf8 = /filename\*=UTF-8''([^;]+)/.exec(disposicion)?.[1];
  const nombre = utf8 ? decodeURIComponent(utf8) : "Informe.pptx";
  return { archivo: await r.blob(), nombre };
}
