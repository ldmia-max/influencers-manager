import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  createClient,
  updateClient,
  createContactAccess,
  revokeContactAccess,
  enviarEnlaceDeAcceso,
} from "@/services/client";
import type {
  ClientPayload,
  ClientResponse,
  ClientAccessPayload,
  ClientAccessResult,
} from "@/services/client";

// =============================================================================
// Create Client
// =============================================================================

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation<ClientResponse, Error, ClientPayload>({
    mutationFn: (payload) => createClient(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
    },
  });
}

// =============================================================================
// Update Client
// =============================================================================

export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation<
    ClientResponse,
    Error,
    { clientId: string; payload: ClientPayload }
  >({
    mutationFn: ({ clientId, payload }) => updateClient(clientId, payload),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.detail(clientId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
    },
  });
}

// =============================================================================
// Delete Client
// =============================================================================


// =============================================================================
// Create Client Access (set portal password)
// =============================================================================

export function useCreateContactAccess() {
  const queryClient = useQueryClient();

  return useMutation<
    ClientAccessResult,
    Error,
    { clientId: string; contactoId: string; payload: ClientAccessPayload }
  >({
    mutationFn: ({ clientId, contactoId, payload }) =>
      createContactAccess(clientId, contactoId, payload),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.clients.detail(clientId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.clients.access(clientId),
      });
    },
  });
}

// =============================================================================
// Revoke Client Access
// =============================================================================

export function useRevokeContactAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, contactoId }: { clientId: string; contactoId: string }) =>
      revokeContactAccess(clientId, contactoId),
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.clients.detail(clientId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.clients.access(clientId),
      });
    },
  });
}

// =============================================================================
// Enlace para que el cliente elija su contrasena
// =============================================================================

/**
 * No invalida nada: mandar el enlace no cambia el acceso guardado. La
 * contrasena solo cambia cuando el cliente abre el enlace y la elige.
 */
export function useEnviarEnlaceDeAcceso() {
  return useMutation({
    mutationFn: ({ clientId, contactoId }: { clientId: string; contactoId: string }) =>
      enviarEnlaceDeAcceso(clientId, contactoId),
  });
}
