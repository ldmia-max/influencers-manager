// =============================================================================
// Client approval flow types (single source of truth)
// =============================================================================

export interface ApprovalProfileService {
  id: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  serviceType: {
    id: string;
    name: string;
    displayName: string;
  };
}

export interface ApprovalProfilePlatform {
  id: string;
  socialAccount: {
    id: string;
    username: string;
    followers: number | null;
    platform: {
      id: string;
      name: string;
      displayName: string;
    };
  };
  services: ApprovalProfileService[];
}

export interface ApprovalProfile {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  profile: {
    id: string;
    name: string;
    type: string;
  };
  platforms: ApprovalProfilePlatform[];
}

export interface ApprovalCampaign {
  id: string;
  name: string;
  description: string | null;
  budget: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  client: {
    id: string;
    companyName: string;
  };
  clientContact: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  profiles: ApprovalProfile[];
}

export interface ApprovalData {
  campaign: ApprovalCampaign;
  token: {
    id: string;
    expiresAt: string;
  };
}

export interface SubmitApprovalResult {
  message: string;
  summary: {
    totalProfiles: number;
    approvedProfiles: number;
    rejectedProfiles: number;
  };
}
