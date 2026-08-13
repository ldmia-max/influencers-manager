// Data Access Layer - Barrel Exports
// All database operations are centralized here.
// Routes and pages should import from this layer instead of using prisma directly.

export { ValidationError, NotFoundError } from "./errors";

// --- Admin entities ---
export {
  getCachedGenders,
  getActiveGenders,
  createGender,
} from "./genders";

export {
  getCachedPlatforms,
  getAllPlatformsWithCounts,
  getActivePlatforms,
  createPlatform,
  updatePlatform,
  deletePlatform,
} from "./platforms";

export {
  getCachedServiceTypes,
  getAllServiceTypesWithCounts,
  createServiceType,
  updateServiceType,
  deleteServiceType,
} from "./service-types";

export {
  getCachedReachRanges,
  getAllReachRanges,
  createReachRange,
  updateReachRange,
  patchReachRange,
  deleteReachRange,
} from "./reach-ranges";

export {
  getCachedCountries,
  getCachedDepartments,
  getCachedCities,
  getAllCountriesWithCounts,
  createCountry,
  patchCountry,
  updateCountry,
  deleteCountry,
  getAllDepartmentsWithCountries,
  createDepartment,
  patchDepartment,
  updateDepartment,
  deleteDepartment,
  getAllCitiesWithDepartments,
  createCity,
  patchCity,
  updateCity,
  deleteCity,
} from "./locations";

export {
  getCachedCategories,
  getActiveCategories,
  getCategoryById,
  getCategoriesPaginated,
  createCategory,
  updateCategory,
  deleteCategory,
} from "./categories";

// --- Users ---
export {
  getUserEmailById,
  getAllUsersForAdmin,
  createUserAdmin,
  updateUser,
  deleteUser,
  registerUser,
} from "./users";

// --- Clients ---
export {
  getClientsWithContacts,
  getClientsPaginated,
  getClientsForPage,
  getClientById,
  getClientForEdit,
  createClient,
  updateClient,
  deleteClient,
  createOrUpdateClientAccess,
  deleteClientAccess,
  loginClient,
} from "./clients";

// --- Profiles ---
export {
  getCachedProfiles,
  getCachedProfile,
  getAllProfilesForEditor,
  getProfilesPaginated,
  getProfilesAll,
  getProfileById,
  getProfileForEdit,
  getProfileCount,
  createProfile,
  updateProfile,
  deleteProfile,
  getProfileWithSocialAccounts,
  updateSocialAccountMetrics,
  refetchProfile,
} from "./profiles";
export type { ProfileWithRelations, ProfileFilters } from "./profiles";

// --- Campaigns ---
export {
  getCampaignsPaginated,
  getCampaignById,
  getCampaignsForPage,
  getCampaignDetail,
  getCampaignForEdit,
  getDashboardCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  transitionCampaignStatus,
  regenerateApprovalToken,
} from "./campaigns";

// --- Campaign Profiles ---
export {
  getCampaignProfiles,
  setCampaignProfiles,
  removeCampaignProfiles,
} from "./campaign-profiles";

// --- Campaign Approval ---
export {
  getApprovalData,
  saveApprovalDecisions,
  submitApproval,
  getRejectedProfileDetails,
} from "./campaign-approval";
