import { apiPost, apiPatch, apiDelete } from "./api";

export interface RegistrarEntregaPayload {
  campaignServiceId: string;
  /** Vacia en los formatos efimeros, que se confirman con la fecha. */
  url?: string | null;
  publicadoEn?: string | null;
  notas?: string | null;
  /** Solo en formatos efímeros. */
  vistasReportadas?: number | null;
  /** Qué formato es la pieza. La interfaz lo envía siempre. */
  serviceTypeId?: string | null;
}

export interface EntregaCreada {
  id: string;
  url: string | null;
  entregadoEn: string;
}

export function registrarEntrega(campaignId: string, datos: RegistrarEntregaPayload) {
  return apiPost<EntregaCreada>(`/api/campaigns/${campaignId}/entregas`, datos);
}

export function actualizarEntrega(
  campaignId: string,
  entregaId: string,
  datos: { url?: string; publicadoEn?: string | null; notas?: string | null }
) {
  return apiPatch<{ id: string; url: string }>(
    `/api/campaigns/${campaignId}/entregas/${entregaId}`,
    datos
  );
}

export function eliminarEntrega(campaignId: string, entregaId: string) {
  return apiDelete<{ eliminado: string }>(
    `/api/campaigns/${campaignId}/entregas/${entregaId}`
  );
}

/** Anota las vistas que reportó el creador de una historia o directo. */
export function registrarVistas(
  campaignId: string,
  entregaId: string,
  vistas: number
) {
  return apiPost<{ id: string; vistas: number | null; capturadoEn: string }>(
    `/api/campaigns/${campaignId}/entregas/${entregaId}/vistas`,
    { vistas }
  );
}

export function fijarFechaLimite(
  campaignId: string,
  servicioId: string,
  datos: { fechaLimite: string | null; aplicarATodos?: boolean }
) {
  return apiPatch<{ id?: string; formatosActualizados?: number }>(
    `/api/campaigns/${campaignId}/formatos/${servicioId}`,
    datos
  );
}

export type AccionParticipacion =
  | { accion: "retirar"; origen: "INFLUENCER" | "CLIENTE" | "AGENCIA"; motivo?: string | null }
  | { accion: "reactivar" };

export function cambiarParticipacion(
  campaignId: string,
  perfilId: string,
  datos: AccionParticipacion
) {
  return apiPatch<{ id: string; participacion: string }>(
    `/api/campaigns/${campaignId}/participacion/${perfilId}`,
    datos
  );
}
