/**
 * Admin API services for platforms, users, and service types
 */

import { apiPost, apiPut, apiPatch, apiDelete } from "./api";
import type { CreatePlatformPayload, UpdatePlatformPayload } from "@/lib/schemas/platform";
import type { CreateUserPayload, UpdateUserPayload } from "@/lib/schemas/user";
import type { CreateServiceTypePayload, UpdateServiceTypePayload } from "@/lib/schemas/service-type";
import type { CreateCountryPayload, PatchCountryPayload, CreateDepartmentPayload, PatchDepartmentPayload, CreateCityPayload, PatchCityPayload } from "@/lib/schemas/location";
import type { CreateReachRangePayload, PatchReachRangePayload } from "@/lib/schemas/reach-range";

// Re-export types from schemas
export type { CreatePlatformPayload, UpdatePlatformPayload };
export type { CreateUserPayload, UpdateUserPayload };
export type { CreateServiceTypePayload, UpdateServiceTypePayload };
export type EditServiceTypePayload = UpdateServiceTypePayload;
export type { CreateCountryPayload, PatchCountryPayload };
export type { CreateDepartmentPayload, PatchDepartmentPayload };
export type { CreateCityPayload, PatchCityPayload };
export type { CreateReachRangePayload, PatchReachRangePayload };

// Backwards-compatible aliases for location/reach-range update types
export type UpdateCountryPayload = CreateCountryPayload;
export type UpdateDepartmentPayload = CreateDepartmentPayload;
export type UpdateCityPayload = CreateCityPayload;
export type UpdateReachRangePayload = CreateReachRangePayload;

// =============================================================================
// Types (re-exported from models/)
// =============================================================================

import type {
  Platform,
  User,
  ServiceType,
  Country,
  Department,
  City,
  ReachRange,
} from "@/models/admin";

export type {
  Platform,
  User,
  ServiceType,
  Country,
  Department,
  City,
  ReachRange,
};

// =============================================================================
// Platforms
// =============================================================================

export async function createPlatform(payload: CreatePlatformPayload): Promise<Platform> {
  return apiPost<Platform>("/api/admin/platforms", payload);
}

export async function updatePlatform(id: string, payload: UpdatePlatformPayload): Promise<Platform> {
  return apiPatch<Platform>(`/api/admin/platforms/${id}`, payload);
}

export async function deletePlatform(id: string): Promise<{ success: boolean }> {
  return apiDelete(`/api/admin/platforms/${id}`);
}

export async function togglePlatform(id: string, isActive: boolean): Promise<Platform> {
  return apiPatch<Platform>(`/api/admin/platforms/${id}`, { isActive });
}

// =============================================================================
// Users
// =============================================================================

export async function createUser(payload: CreateUserPayload): Promise<User> {
  return apiPost<User>("/api/admin/users", payload);
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<User> {
  return apiPatch<User>(`/api/admin/users/${id}`, payload);
}

export async function deleteUser(id: string): Promise<{ success: boolean }> {
  return apiDelete(`/api/admin/users/${id}`);
}

// =============================================================================
// Service Types
// =============================================================================

export async function createServiceType(payload: CreateServiceTypePayload): Promise<ServiceType> {
  return apiPost<ServiceType>("/api/admin/service-types", payload);
}

export async function editServiceType(id: string, payload: UpdateServiceTypePayload): Promise<ServiceType> {
  return apiPatch<ServiceType>(`/api/admin/service-types/${id}`, payload);
}

export const updateServiceType = editServiceType;

export async function deleteServiceType(id: string): Promise<{ success: boolean }> {
  return apiDelete(`/api/admin/service-types/${id}`);
}

export async function toggleServiceType(id: string, isActive: boolean): Promise<ServiceType> {
  return apiPatch<ServiceType>(`/api/admin/service-types/${id}`, { isActive });
}

// =============================================================================
// Countries
// =============================================================================

export async function createCountry(payload: CreateCountryPayload): Promise<Country> {
  return apiPost<Country>("/api/admin/countries", payload);
}

export async function updateCountry(id: string, payload: CreateCountryPayload): Promise<Country> {
  return apiPut<Country>(`/api/admin/countries/${id}`, payload);
}

export async function deleteCountry(id: string): Promise<{ success: boolean }> {
  return apiDelete(`/api/admin/countries/${id}`);
}

export async function toggleCountry(id: string, isActive: boolean): Promise<Country> {
  return apiPatch<Country>(`/api/admin/countries/${id}`, { isActive });
}

// =============================================================================
// Departments
// =============================================================================

export async function createDepartment(payload: CreateDepartmentPayload): Promise<Department> {
  return apiPost<Department>("/api/admin/departments", payload);
}

export async function updateDepartment(id: string, payload: CreateDepartmentPayload): Promise<Department> {
  return apiPut<Department>(`/api/admin/departments/${id}`, payload);
}

export async function deleteDepartment(id: string): Promise<{ success: boolean }> {
  return apiDelete(`/api/admin/departments/${id}`);
}

export async function toggleDepartment(id: string, isActive: boolean): Promise<Department> {
  return apiPatch<Department>(`/api/admin/departments/${id}`, { isActive });
}

// =============================================================================
// Cities
// =============================================================================

export async function createCity(payload: CreateCityPayload): Promise<City> {
  return apiPost<City>("/api/admin/cities", payload);
}

export async function updateCity(id: string, payload: CreateCityPayload): Promise<City> {
  return apiPut<City>(`/api/admin/cities/${id}`, payload);
}

export async function deleteCity(id: string): Promise<{ success: boolean }> {
  return apiDelete(`/api/admin/cities/${id}`);
}

export async function toggleCity(id: string, isActive: boolean): Promise<City> {
  return apiPatch<City>(`/api/admin/cities/${id}`, { isActive });
}

// =============================================================================
// Reach Ranges
// =============================================================================

export async function createReachRange(payload: CreateReachRangePayload): Promise<ReachRange> {
  return apiPost<ReachRange>("/api/admin/reach-ranges", payload);
}

export async function updateReachRange(id: string, payload: CreateReachRangePayload): Promise<ReachRange> {
  return apiPut<ReachRange>(`/api/admin/reach-ranges/${id}`, payload);
}

export async function deleteReachRange(id: string): Promise<{ success: boolean }> {
  return apiDelete(`/api/admin/reach-ranges/${id}`);
}

export async function toggleReachRange(id: string, isActive: boolean): Promise<ReachRange> {
  return apiPatch<ReachRange>(`/api/admin/reach-ranges/${id}`, { isActive });
}
