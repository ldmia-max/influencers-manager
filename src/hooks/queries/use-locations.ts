import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiGet } from "@/services/api";

// =============================================================================
// Types (matching profile-form.tsx local interfaces)
// =============================================================================

export interface Department {
  id: string;
  name: string;
  code: string | null;
  countryId: string;
}

export interface City {
  id: string;
  name: string;
  departmentId: string;
}

// =============================================================================
// Departments by Country (cascading select)
// =============================================================================

export function useDepartments(countryId: string) {
  return useQuery<Department[]>({
    queryKey: queryKeys.locations.departments(countryId),
    queryFn: () =>
      apiGet<Department[]>(`/api/locations/departments?countryId=${countryId}`),
    enabled: !!countryId,
  });
}

// =============================================================================
// Cities by Department (cascading select)
// =============================================================================

export function useCities(departmentId: string) {
  return useQuery<City[]>({
    queryKey: queryKeys.locations.cities(departmentId),
    queryFn: () =>
      apiGet<City[]>(`/api/locations/cities?departmentId=${departmentId}`),
    enabled: !!departmentId,
  });
}
