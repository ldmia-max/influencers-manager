// =============================================================================
// Social media processing types (single source of truth)
// =============================================================================

export interface NormalizedSocialData {
  username: string;
  fullName: string | null;
  biography: string | null;
  profilePicUrl: string | null;
  followers: number | null;
  following: number | null;
  posts: number | null;
  totalLikes: number | null;
  avgViews: number | null;
  engagementRate: number | null;
  verified: boolean | null;
  recentContentText: string;
}

export interface AIProfileAnalysis {
  tags: string[];
  summary: string;
  tone: string;
  language: string;
}

export interface ProcessResult {
  success: boolean;
  message?: string;
  profileId?: string;
}
