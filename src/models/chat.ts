// =============================================================================
// AI Chat types (single source of truth)
// =============================================================================

export interface ChatApiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatApiMessage[];
  campaignState: Record<string, unknown>;
}

export interface ChatResponse {
  content: string;
  campaignState?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface CampaignState {
  name?: string;
  clientId?: string;
  clientContactId?: string;
  budget?: number;
  description?: string;
  startDate?: string;
  endDate?: string;
  campaignCreatedId?: string;
  selectedProfiles: {
    profileId: string;
    profileName: string;
    services: {
      serviceId: string;
      serviceName: string;
      quantity: number;
      price: number;
    }[];
  }[];
}
