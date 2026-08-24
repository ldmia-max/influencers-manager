import { useMutation } from "@tanstack/react-query";
import { submitApproval } from "@/services/approval";
import type {
  SubmitApprovalPayload,
  SubmitApprovalResult,
} from "@/services/approval";

// =============================================================================
// Submit Approval Decisions
// =============================================================================

export function useSubmitApproval(token: string) {
  return useMutation<SubmitApprovalResult, Error, SubmitApprovalPayload>({
    mutationFn: (payload) => submitApproval(token, payload),
    // A proposito NO se invalida la consulta del enlace.
    //
    // El token es de un solo uso: al enviar la aprobacion queda marcado
    // como usado, asi que volver a pedirlo devolveria USED_TOKEN y la
    // pantalla de error taparia la de "aprobacion enviada". El cliente
    // veia "el enlace ya fue utilizado" justo despues de pulsar enviar,
    // como si algo hubiera fallado.
    //
    // Lo que hay que mostrar despues de enviar sale de la respuesta de
    // la propia mutacion, no de una relectura.
  });
}
