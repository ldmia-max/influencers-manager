// =============================================================================
// Client domain types (single source of truth)
// =============================================================================

export interface ClientResponse {
  id: string;
  companyName: string;
  nit: string;
  email: string;
}

export interface ClientAccessResult {
  success: boolean;
  message?: string;
}

export interface ClientDetail {
  id: string;
  companyName: string;
  rut: string | null;
  website: string | null;
  hasPortalAccess: boolean;
  contacts: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    isPrimary: boolean;
  }>;
}
