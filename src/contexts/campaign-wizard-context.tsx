"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { CampaignStatus } from "@prisma/client";
import type { Client, ProfileWithServices } from "@/models/campaign";
import type { UseProfileFiltersReturn } from "@/hooks/use-profile-filters";

// =============================================================================
// Context value — server data + async callbacks that cannot live in the store
// =============================================================================

interface CampaignWizardContextValue {
  // Server data (from props, not mutable)
  clients: Client[];
  profiles: ProfileWithServices[];
  currentStatus: CampaignStatus;

  // Filters (computed from profiles — hook result, not serializable)
  filters: UseProfileFiltersReturn;

  // Async action callbacks (need router, API calls)
  onSave: (sendToReview: boolean) => void;
  onActivateDirectly: (reason: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onCancel: () => void;
}

const CampaignWizardContext = createContext<CampaignWizardContextValue | null>(null);

export function useCampaignWizard() {
  const context = useContext(CampaignWizardContext);
  if (!context) {
    throw new Error("useCampaignWizard must be used within CampaignWizardProvider");
  }
  return context;
}

interface CampaignWizardProviderProps {
  children: ReactNode;
  value: CampaignWizardContextValue;
}

export function CampaignWizardProvider({ children, value }: CampaignWizardProviderProps) {
  return (
    <CampaignWizardContext.Provider value={value}>
      {children}
    </CampaignWizardContext.Provider>
  );
}
