// =============================================================================
// Admin entity types (single source of truth)
// =============================================================================

export interface Platform {
  id: string;
  name: string;
  displayName: string;
  isActive: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
}

export interface ServiceType {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  platformId: string;
  profileTypes: ("INFLUENCER" | "UGC" | "BOTH")[];
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug?: string;
}

export interface Gender {
  id: string;
  name: string;
  displayName: string;
}

export interface Country {
  id: string;
  name: string;
  code: string;
  isActive?: boolean;
}

export interface Department {
  id: string;
  name: string;
  code?: string | null;
  countryId: string;
  isActive?: boolean;
}

export interface City {
  id: string;
  name: string;
  departmentId: string;
  isActive?: boolean;
}

export interface ReachRange {
  id: string;
  name: string;
  displayName: string;
  minFollowers: number;
  maxFollowers: number | null;
  reachPercentage: number;
  isActive: boolean;
}
