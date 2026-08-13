import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiGet } from "@/services/api";

// =============================================================================
// Types
// =============================================================================

interface AdminPlatform {
  id: string;
  name: string;
  displayName: string;
  isActive: boolean;
}

interface AdminCountry {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

// =============================================================================
// Admin Platforms (for selects in service-type forms, etc.)
// =============================================================================

export function useAdminPlatforms() {
  return useQuery<AdminPlatform[]>({
    queryKey: queryKeys.admin.platforms(),
    queryFn: () => apiGet<AdminPlatform[]>("/api/admin/platforms"),
  });
}

// =============================================================================
// Admin Countries (for selects in department forms)
// =============================================================================

export function useAdminCountries() {
  return useQuery<AdminCountry[]>({
    queryKey: queryKeys.admin.countries(),
    queryFn: () => apiGet<AdminCountry[]>("/api/admin/countries"),
  });
}
