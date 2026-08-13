import "server-only";

// Re-export shim: cached functions moved to src/data-access/
export { getCachedPlatforms } from "@/data-access/platforms";
export { getCachedCategories } from "@/data-access/categories";
export { getCachedServiceTypes } from "@/data-access/service-types";
export { getCachedGenders } from "@/data-access/genders";
export {
  getCachedCountries,
  getCachedDepartments,
  getCachedCities,
} from "@/data-access/locations";
export { getCachedReachRanges } from "@/data-access/reach-ranges";
export {
  getCachedProfiles,
  getCachedProfile,
  type ProfileWithRelations,
} from "@/data-access/profiles";
export type { ProfileFilters } from "@/data-access/profiles";
