import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { queryKeys } from "@/lib/query-keys";
import {
  createPlatform,
  updatePlatform,
  deletePlatform,
  togglePlatform,
  createUser,
  updateUser,
  deleteUser,
  createServiceType,
  updateServiceType,
  deleteServiceType,
  toggleServiceType,
  createCountry,
  updateCountry,
  deleteCountry,
  toggleCountry,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  toggleDepartment,
  createCity,
  updateCity,
  deleteCity,
  toggleCity,
  createReachRange,
  updateReachRange,
  deleteReachRange,
  toggleReachRange,
} from "@/services/admin";
import type {
  Platform,
  CreatePlatformPayload,
  UpdatePlatformPayload,
  User,
  CreateUserPayload,
  UpdateUserPayload,
  ServiceType,
  CreateServiceTypePayload,
  UpdateServiceTypePayload,
  Country,
  CreateCountryPayload,
  UpdateCountryPayload,
  Department,
  CreateDepartmentPayload,
  UpdateDepartmentPayload,
  City,
  CreateCityPayload,
  UpdateCityPayload,
  ReachRange,
  CreateReachRangePayload,
  UpdateReachRangePayload,
} from "@/services/admin";

// =============================================================================
// Helper: creates a standard mutation with router.refresh + query invalidation
// =============================================================================

function useAdminMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  invalidateKeys: readonly (readonly unknown[])[],
) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<TData, Error, TVariables>({
    mutationFn,
    onSuccess: () => {
      for (const key of invalidateKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      router.refresh();
    },
  });
}

// =============================================================================
// Platforms
// =============================================================================

export function useCreatePlatform() {
  return useAdminMutation<Platform, CreatePlatformPayload>(
    (payload) => createPlatform(payload),
    [queryKeys.admin.platforms(), queryKeys.platforms.all],
  );
}

export function useUpdatePlatform() {
  return useAdminMutation<Platform, { id: string; payload: UpdatePlatformPayload }>(
    ({ id, payload }) => updatePlatform(id, payload),
    [queryKeys.admin.platforms(), queryKeys.platforms.all],
  );
}

export function useDeletePlatform() {
  return useAdminMutation<{ success: boolean }, string>(
    (id) => deletePlatform(id),
    [queryKeys.admin.platforms(), queryKeys.platforms.all],
  );
}

export function useTogglePlatform() {
  return useAdminMutation<Platform, { id: string; isActive: boolean }>(
    ({ id, isActive }) => togglePlatform(id, isActive),
    [queryKeys.admin.platforms(), queryKeys.platforms.all],
  );
}

// =============================================================================
// Users
// =============================================================================

export function useCreateUser() {
  return useAdminMutation<User, CreateUserPayload>(
    (payload) => createUser(payload),
    [queryKeys.admin.users()],
  );
}

export function useUpdateUser() {
  return useAdminMutation<User, { id: string; payload: UpdateUserPayload }>(
    ({ id, payload }) => updateUser(id, payload),
    [queryKeys.admin.users()],
  );
}

export function useDeleteUser() {
  return useAdminMutation<{ success: boolean }, string>(
    (id) => deleteUser(id),
    [queryKeys.admin.users()],
  );
}

// =============================================================================
// Service Types
// =============================================================================

export function useCreateServiceType() {
  return useAdminMutation<ServiceType, CreateServiceTypePayload>(
    (payload) => createServiceType(payload),
    [queryKeys.admin.serviceTypes(), queryKeys.serviceTypes.all],
  );
}

export function useUpdateServiceType() {
  return useAdminMutation<ServiceType, { id: string; payload: UpdateServiceTypePayload }>(
    ({ id, payload }) => updateServiceType(id, payload),
    [queryKeys.admin.serviceTypes(), queryKeys.serviceTypes.all],
  );
}

export function useDeleteServiceType() {
  return useAdminMutation<{ success: boolean }, string>(
    (id) => deleteServiceType(id),
    [queryKeys.admin.serviceTypes(), queryKeys.serviceTypes.all],
  );
}

export function useToggleServiceType() {
  return useAdminMutation<ServiceType, { id: string; isActive: boolean }>(
    ({ id, isActive }) => toggleServiceType(id, isActive),
    [queryKeys.admin.serviceTypes(), queryKeys.serviceTypes.all],
  );
}

// =============================================================================
// Countries
// =============================================================================

export function useCreateCountry() {
  return useAdminMutation<Country, CreateCountryPayload>(
    (payload) => createCountry(payload),
    [queryKeys.admin.countries(), queryKeys.locations.countries()],
  );
}

export function useUpdateCountry() {
  return useAdminMutation<Country, { id: string; payload: UpdateCountryPayload }>(
    ({ id, payload }) => updateCountry(id, payload),
    [queryKeys.admin.countries(), queryKeys.locations.countries()],
  );
}

export function useDeleteCountry() {
  return useAdminMutation<{ success: boolean }, string>(
    (id) => deleteCountry(id),
    [queryKeys.admin.countries(), queryKeys.locations.countries()],
  );
}

export function useToggleCountry() {
  return useAdminMutation<Country, { id: string; isActive: boolean }>(
    ({ id, isActive }) => toggleCountry(id, isActive),
    [queryKeys.admin.countries(), queryKeys.locations.countries()],
  );
}

// =============================================================================
// Departments
// =============================================================================

export function useCreateDepartment() {
  return useAdminMutation<Department, CreateDepartmentPayload>(
    (payload) => createDepartment(payload),
    [queryKeys.admin.departments(), queryKeys.locations.all],
  );
}

export function useUpdateDepartment() {
  return useAdminMutation<Department, { id: string; payload: UpdateDepartmentPayload }>(
    ({ id, payload }) => updateDepartment(id, payload),
    [queryKeys.admin.departments(), queryKeys.locations.all],
  );
}

export function useDeleteDepartment() {
  return useAdminMutation<{ success: boolean }, string>(
    (id) => deleteDepartment(id),
    [queryKeys.admin.departments(), queryKeys.locations.all],
  );
}

export function useToggleDepartment() {
  return useAdminMutation<Department, { id: string; isActive: boolean }>(
    ({ id, isActive }) => toggleDepartment(id, isActive),
    [queryKeys.admin.departments(), queryKeys.locations.all],
  );
}

// =============================================================================
// Cities
// =============================================================================

export function useCreateCity() {
  return useAdminMutation<City, CreateCityPayload>(
    (payload) => createCity(payload),
    [queryKeys.admin.cities(), queryKeys.locations.all],
  );
}

export function useUpdateCity() {
  return useAdminMutation<City, { id: string; payload: UpdateCityPayload }>(
    ({ id, payload }) => updateCity(id, payload),
    [queryKeys.admin.cities(), queryKeys.locations.all],
  );
}

export function useDeleteCity() {
  return useAdminMutation<{ success: boolean }, string>(
    (id) => deleteCity(id),
    [queryKeys.admin.cities(), queryKeys.locations.all],
  );
}

export function useToggleCity() {
  return useAdminMutation<City, { id: string; isActive: boolean }>(
    ({ id, isActive }) => toggleCity(id, isActive),
    [queryKeys.admin.cities(), queryKeys.locations.all],
  );
}

// =============================================================================
// Reach Ranges
// =============================================================================

export function useCreateReachRange() {
  return useAdminMutation<ReachRange, CreateReachRangePayload>(
    (payload) => createReachRange(payload),
    [queryKeys.admin.reachRanges(), queryKeys.reachRanges.all],
  );
}

export function useUpdateReachRange() {
  return useAdminMutation<ReachRange, { id: string; payload: UpdateReachRangePayload }>(
    ({ id, payload }) => updateReachRange(id, payload),
    [queryKeys.admin.reachRanges(), queryKeys.reachRanges.all],
  );
}

export function useDeleteReachRange() {
  return useAdminMutation<{ success: boolean }, string>(
    (id) => deleteReachRange(id),
    [queryKeys.admin.reachRanges(), queryKeys.reachRanges.all],
  );
}

export function useToggleReachRange() {
  return useAdminMutation<ReachRange, { id: string; isActive: boolean }>(
    ({ id, isActive }) => toggleReachRange(id, isActive),
    [queryKeys.admin.reachRanges(), queryKeys.reachRanges.all],
  );
}
