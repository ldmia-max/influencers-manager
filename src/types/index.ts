import type { ProfileType } from "@prisma/client";

// Re-export Prisma enums for convenience
export { ProfileType, UserRole } from "@prisma/client";

// Profile with all relations
export interface ProfileWithRelations {
  id: string;
  name: string;
  type: ProfileType;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  socialAccounts: SocialAccountWithRelations[];
  categories: CategoryRelation[];
}

export interface SocialAccountWithRelations {
  id: string;
  username: string;
  profileUrl: string | null;
  followers: number | null;
  following: number | null;
  posts: number | null;
  avgViews: number | null;
  avgLikes: number | null;
  engagementRate: number | null;
  lastSyncAt: Date | null;
  platform: {
    id: string;
    name: string;
    displayName: string;
  };
  services: ProfileServiceWithType[];
}

export interface ProfileServiceWithType {
  id: string;
  price: number;
  currency: string;
  notes: string | null;
  serviceType: {
    id: string;
    name: string;
    displayName: string;
  };
}

export interface CategoryRelation {
  category: {
    id: string;
    name: string;
    slug: string;
  };
}

// Form types for creating/editing profiles
export interface CreateProfileInput {
  name: string;
  type: ProfileType;
  socialAccounts: {
    platformId: string;
    username: string;
    services: {
      serviceTypeId: string;
      price: number;
      currency?: string;
      notes?: string;
    }[];
  }[];
  categoryIds: string[];
}

export interface UpdateProfileInput extends Partial<CreateProfileInput> {
  id: string;
}

// Search/filter types
export interface ProfileFilters {
  search?: string;
  type?: ProfileType;
  platforms?: string[];
  categories?: string[];
  minFollowers?: number;
  maxFollowers?: number;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
