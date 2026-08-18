import { create } from "zustand";
import { calculateMarkupPrice, MARKUP_PERCENTAGE } from "@/lib/campaign-utils";
import type { CampaignData, ProfileConfig, WizardStep } from "@/models/campaign";

// =============================================================================
// Types
// =============================================================================

interface CampaignWizardStore {
  // Campaign identity
  campaignId: string | undefined;
  /**
   * Margen aplicado en el asistente. Al editar una campana existente es
   * el suyo, congelado; al crear una nueva, el global por defecto. Sin
   * esto, editar una campana antigua mostraria precios distintos a los
   * que el cliente aprobo.
   */
  markup: number;

  // Form slice
  formData: CampaignData;
  clientPopoverOpen: boolean;
  contactPopoverOpen: boolean;

  // Profiles slice
  selectedProfileIds: string[];
  profileConfigs: ProfileConfig[];

  // UI slice
  loading: boolean;
  error: string;
  success: string;
  currentStep: WizardStep;
  showFilters: boolean;

  // Computed
  getBudget: () => number;
  getTotalServicesPrice: () => number;
  getIsOverBudget: () => boolean;
  getBudgetRemaining: () => number;
  getBudgetUsedPercentage: () => number;

  // Form actions
  setCampaignId: (id: string) => void;
  setMarkup: (markup: number) => void;
  setFormData: (data: CampaignData) => void;
  setClientPopoverOpen: (open: boolean) => void;
  setContactPopoverOpen: (open: boolean) => void;

  // UI actions
  setLoading: (v: boolean) => void;
  setError: (v: string) => void;
  setSuccess: (v: string) => void;
  setCurrentStep: (step: WizardStep) => void;
  setShowFilters: (v: boolean) => void;

  // Profile actions
  setSelectedProfileIds: (ids: string[]) => void;
  setProfileConfigs: (configs: ProfileConfig[] | ((prev: ProfileConfig[]) => ProfileConfig[])) => void;
  toggleProfile: (profileId: string) => void;
  removeProfile: (profileId: string) => void;
  togglePlatform: (profileId: string, socialAccountId: string) => void;
  toggleService: (profileId: string, socialAccountId: string, serviceId: string) => void;
  setComboActivo: (profileId: string, socialAccountId: string, activo: boolean) => void;
  setComboPrecio: (profileId: string, socialAccountId: string, precio: number) => void;
  setComboDescripcion: (profileId: string, socialAccountId: string, texto: string) => void;
  updateServiceQuantity: (
    profileId: string,
    socialAccountId: string,
    serviceId: string,
    quantity: number
  ) => void;

  // Lifecycle
  reset: () => void;
}

// =============================================================================
// Default state
// =============================================================================

const defaultFormData: CampaignData = {
  name: "",
  description: "",
  clientId: "",
  clientContactId: "",
  budget: "",
  startDate: "",
  endDate: "",
};

const defaultState = {
  campaignId: undefined as string | undefined,
  formData: defaultFormData,
  clientPopoverOpen: false,
  contactPopoverOpen: false,
  selectedProfileIds: [] as string[],
  profileConfigs: [] as ProfileConfig[],
  loading: false,
  error: "",
  success: "",
  currentStep: 1 as WizardStep,
  showFilters: true,
  // Se sobrescribe al editar una campana existente con el suyo.
  markup: MARKUP_PERCENTAGE,
};

// =============================================================================
// Store
// =============================================================================

export const useCampaignWizardStore = create<CampaignWizardStore>()((set, get) => ({
  ...defaultState,

  // Computed
  getBudget: () => parseInt(get().formData.budget, 10) || 0,

  getTotalServicesPrice: () => {
    let total = 0;
    get().profileConfigs.forEach((pc) => {
      pc.platforms.forEach((p) => {
        if (p.selected) {
          p.services.forEach((s) => {
            if (s.quantity > 0) {
              total += calculateMarkupPrice(s.basePrice, get().markup) * s.quantity;
            }
          });
        }
      });
    });
    return total;
  },

  getIsOverBudget: () => get().getTotalServicesPrice() > get().getBudget(),

  getBudgetRemaining: () => get().getBudget() - get().getTotalServicesPrice(),

  getBudgetUsedPercentage: () => {
    const budget = get().getBudget();
    return budget > 0 ? (get().getTotalServicesPrice() / budget) * 100 : 0;
  },

  // Form actions
  setMarkup: (markup) => set({ markup }),
  setCampaignId: (id) => set({ campaignId: id }),
  setFormData: (data) => set({ formData: data }),
  setClientPopoverOpen: (open) => set({ clientPopoverOpen: open }),
  setContactPopoverOpen: (open) => set({ contactPopoverOpen: open }),

  // UI actions
  setLoading: (v) => set({ loading: v }),
  setError: (v) => set({ error: v }),
  setSuccess: (v) => set({ success: v }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setShowFilters: (v) => set({ showFilters: v }),

  // Profile state setters (for sync from useEffect)
  setSelectedProfileIds: (ids) => set({ selectedProfileIds: ids }),
  setProfileConfigs: (configs) =>
    set((state) => ({
      profileConfigs:
        typeof configs === "function" ? configs(state.profileConfigs) : configs,
    })),

  // Toggle a profile in/out of selection
  toggleProfile: (profileId) => {
    const { selectedProfileIds, profileConfigs } = get();
    const isSelected = selectedProfileIds.includes(profileId);

    if (isSelected) {
      set({
        selectedProfileIds: selectedProfileIds.filter((id) => id !== profileId),
        profileConfigs: profileConfigs.filter((pc) => pc.profileId !== profileId),
      });
    } else {
      set({ selectedProfileIds: [...selectedProfileIds, profileId] });
    }
  },

  removeProfile: (profileId) => {
    set((state) => ({
      selectedProfileIds: state.selectedProfileIds.filter((id) => id !== profileId),
      profileConfigs: state.profileConfigs.filter((pc) => pc.profileId !== profileId),
    }));
  },

  togglePlatform: (profileId, socialAccountId) => {
    set((state) => ({
      profileConfigs: state.profileConfigs.map((pc) => {
        if (pc.profileId !== profileId) return pc;
        return {
          ...pc,
          platforms: pc.platforms.map((plat) => {
            if (plat.socialAccountId !== socialAccountId) return plat;
            const newSelected = !plat.selected;
            return {
              ...plat,
              selected: newSelected,
              services: newSelected
                ? plat.services
                : plat.services.map((s) => ({ ...s, quantity: 0 })),
            };
          }),
        };
      }),
    }));
  },

  toggleService: (profileId, socialAccountId, serviceId) => {
    set((state) => ({
      profileConfigs: state.profileConfigs.map((pc) => {
        if (pc.profileId !== profileId) return pc;
        return {
          ...pc,
          platforms: pc.platforms.map((plat) => {
            if (plat.socialAccountId !== socialAccountId) return plat;
            return {
              ...plat,
              services: plat.services.map((s) => {
                // Los combos no tienen tarifa de origen, asi que se
                // identifican por su serviceTypeId sintetico.
                const clave = s.profileServiceId ?? s.serviceTypeId;
                if (clave !== serviceId) return s;
                return { ...s, quantity: s.quantity > 0 ? 0 : 1 };
              }),
            };
          }),
        };
      }),
    }));
  },

  /**
   * El combo se apaga poniendo su precio a 0: no hay unidades que
   * alternar, y el precio es justo lo que decide si entra en la campana.
   */
  setComboActivo: (profileId, socialAccountId, activo) =>
    set((state) => ({
      profileConfigs: state.profileConfigs.map((pc) =>
        pc.profileId !== profileId
          ? pc
          : {
              ...pc,
              platforms: pc.platforms.map((p) =>
                p.socialAccountId !== socialAccountId
                  ? p
                  : {
                      ...p,
                      services: p.services.map((s) =>
                        s.esCombo ? { ...s, basePrice: activo ? s.basePrice : 0 } : s
                      ),
                    }
              ),
            }
      ),
    })),

  setComboPrecio: (profileId, socialAccountId, precio) =>
    set((state) => ({
      profileConfigs: state.profileConfigs.map((pc) =>
        pc.profileId !== profileId
          ? pc
          : {
              ...pc,
              platforms: pc.platforms.map((p) =>
                p.socialAccountId !== socialAccountId
                  ? p
                  : {
                      ...p,
                      services: p.services.map((s) =>
                        s.esCombo ? { ...s, basePrice: precio, quantity: 1 } : s
                      ),
                    }
              ),
            }
      ),
    })),

  setComboDescripcion: (profileId, socialAccountId, texto) =>
    set((state) => ({
      profileConfigs: state.profileConfigs.map((pc) =>
        pc.profileId !== profileId
          ? pc
          : {
              ...pc,
              platforms: pc.platforms.map((p) =>
                p.socialAccountId !== socialAccountId
                  ? p
                  : {
                      ...p,
                      services: p.services.map((s) =>
                        s.esCombo ? { ...s, comboDescripcion: texto } : s
                      ),
                    }
              ),
            }
      ),
    })),

  updateServiceQuantity: (profileId, socialAccountId, serviceId, quantity) => {
    set((state) => ({
      profileConfigs: state.profileConfigs.map((pc) => {
        if (pc.profileId !== profileId) return pc;
        return {
          ...pc,
          platforms: pc.platforms.map((plat) => {
            if (plat.socialAccountId !== socialAccountId) return plat;
            return {
              ...plat,
              services: plat.services.map((s) => {
                // Los combos no tienen tarifa de origen, asi que se
                // identifican por su serviceTypeId sintetico.
                const clave = s.profileServiceId ?? s.serviceTypeId;
                if (clave !== serviceId) return s;
                return { ...s, quantity: Math.max(0, quantity) };
              }),
            };
          }),
        };
      }),
    }));
  },

  // Lifecycle
  reset: () => set(defaultState),
}));
