// =============================================================================
// Profile / Influencer domain types (single source of truth)
// =============================================================================

export interface ProfileSocialAccount {
  id: string;
  username: string;
  fullName: string | null;
  biography: string | null;
  verified: boolean | null;
  profilePicUrl: string | null;
  followers: number | null;
  following: number | null;
  posts: number | null;
  avgLikes: number | null;
  engagement: number | null;
  engagementRate: number | null;
  platform: {
    id: string;
    name: string;
    displayName: string;
  };
  services: {
    id: string;
    price: string | number;
    currency: string;
    serviceType: {
      id: string;
      name: string;
      displayName: string;
    };
  }[];
}

export interface ProfileDetail {
  id: string;
  name: string;
  type: "INFLUENCER" | "UGC" | "BOTH";
  email: string | null;
  phone: string | null;
  countryId: string | null;
  departmentId: string | null;
  cityId: string | null;
  country: {
    id: string;
    name: string;
    code: string;
  } | null;
  department: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  city: {
    id: string;
    name: string;
  } | null;
  notes: string | null;
  gender: {
    id: string;
    name: string;
    displayName: string;
  } | null;
  socialAccounts: ProfileSocialAccount[];
  categories: {
    category: {
      id: string;
      name: string;
      slug: string;
    };
  }[];
  createdBy: {
    name: string;
  } | null;
}

export interface ProfileResponse {
  id: string;
  name: string;
}

export interface SyncResult {
  success: boolean;
  message?: string;
  updatedAccounts?: number;
}
