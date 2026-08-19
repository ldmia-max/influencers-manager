import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  createClient,
  updateClient,
  createClientAccess,
  revokeClientAccess,
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

export function useCreateClientAccess() {
  const queryClient = useQueryClient();

  return useMutation<
    ClientAccessResult,
    Error,
    { clientId: string; payload: ClientAccessPayload }
  >({
    mutationFn: ({ clientId, payload }) =>
      createClientAccess(clientId, payload),
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

export function useRevokeClientAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clientId: string) => revokeClientAccess(clientId),
    onSuccess: (_, clientId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.clients.detail(clientId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.clients.access(clientId),
      });
    },
  });
}
