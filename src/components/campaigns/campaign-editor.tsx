"use client";

import { useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import type { CampaignStatus } from "@prisma/client";
import { calculateMarkupPrice } from "@/lib/campaign-utils";
import { useProfileFilters } from "@/hooks/use-profile-filters";
import {
  createCampaign as createCampaignApi,
  updateCampaign,
  saveCampaignProfiles,
  updateCampaignStatus,
  buildCampaignPayload,
} from "@/services/campaign";
import { CampaignWizardProvider } from "@/contexts/campaign-wizard-context";
import { useCampaignWizardStore } from "@/stores/campaign-wizard-store";
import { CampaignWizardSteps } from "./campaign-wizard-steps";
import { CampaignStepDetails } from "./campaign-step-details";
import { CampaignStepProfiles } from "./campaign-step-profiles";
import { CampaignStepSummary } from "./campaign-step-summary";
import { CampaignNavigationBar } from "./campaign-navigation-bar";
import type {
  CampaignData,
  CampaignEditorProps,
  PlatformConfig,
  ProfileConfig,
  ServiceConfig,
  WizardStep,
} from "@/models/campaign";

// Re-export types for backwards compatibility
export type { ProfileWithServices } from "@/models/campaign";

// Token de sesión a nivel de módulo: evita que el cleanup de una instancia
// anterior del editor limpie el store ya inicializado por la nueva instancia.
// Esto resuelve el race condition entre el cleanup de useEffect (que corre
// después del paint) y la inicialización render-phase de la nueva instancia.
let _activeEditorSessionId: string | null = null;

/**
 * Clave sintetica del combo dentro de una plataforma.
 *
 * El combo no sale del tarifario, asi que no tiene profileServiceId. El
 * store identifica cada servicio por `profileServiceId ?? serviceTypeId`,
 * y este valor ocupa ese segundo hueco.
 */
const COMBO_ID = "__combo__";

/**
 * Fila de combo que se anade a cada plataforma.
 *
 * Se inyecta en la interfaz en vez de guardarse en el tarifario del
 * influencer: un combo es un acuerdo puntual de UNA campana, y crear
 * una tarifa "Combo $0" en cada creador seria informacion falsa.
 */
function construirCombo(
  existingPlatform: PlatformConfig | undefined
): ServiceConfig[] {
  const previo = existingPlatform?.services.find((s) => s.esCombo);
  return [
    {
      profileServiceId: null,
      serviceTypeId: COMBO_ID,
      serviceName: "Combo",
      quantity: 1,
      basePrice: previo?.basePrice ?? 0,
      esCombo: true,
      comboDescripcion: previo?.comboDescripcion ?? "",
    },
  ];
}

export function CampaignEditor({
  campaignId: initialCampaignId,
  initialData,
  clients,
  profiles,
  existingProfileIds = [],
  existingConfig = [],
  currentStatus: currentStatusProp,
  markup,
  onSaveSuccess,
}: CampaignEditorProps) {
  const router = useRouter();
  const currentStatus: CampaignStatus = currentStatusProp ?? "DRAFT";

  // -------------------------------------------------------------------------
  // Store access (granular selectors — no full state subscription)
  // -------------------------------------------------------------------------
  const campaignId = useCampaignWizardStore((s) => s.campaignId);
  const setCampaignId = useCampaignWizardStore((s) => s.setCampaignId);
  const setMarkup = useCampaignWizardStore((s) => s.setMarkup);
  const formData = useCampaignWizardStore((s) => s.formData);
  const selectedProfileIds = useCampaignWizardStore((s) => s.selectedProfileIds);
  const profileConfigs = useCampaignWizardStore((s) => s.profileConfigs);
  const loading = useCampaignWizardStore((s) => s.loading);
  const error = useCampaignWizardStore((s) => s.error);
  const success = useCampaignWizardStore((s) => s.success);
  const currentStep = useCampaignWizardStore((s) => s.currentStep);
  const setLoading = useCampaignWizardStore((s) => s.setLoading);
  const setError = useCampaignWizardStore((s) => s.setError);
  const setSuccess = useCampaignWizardStore((s) => s.setSuccess);
  const setCurrentStep = useCampaignWizardStore((s) => s.setCurrentStep);
  const setSelectedProfileIds = useCampaignWizardStore((s) => s.setSelectedProfileIds);
  const setProfileConfigs = useCampaignWizardStore((s) => s.setProfileConfigs);
  const reset = useCampaignWizardStore((s) => s.reset);

  // Session-storage key: only defined for existing campaigns (edit mode).
  // New campaigns don't persist — F5 on "new" page is intentionally fresh.
  const storageKey = initialCampaignId
    ? `campaign-wizard-${initialCampaignId}`
    : null;

  // -------------------------------------------------------------------------
  // Initialize store synchronously on first render, reset on unmount
  // -------------------------------------------------------------------------
  // sessionId único por instancia del componente — identifica quién es el
  // "dueño" actual del store para evitar que el cleanup de una instancia
  // anterior lo limpie después de que la nueva instancia ya lo inicializó.
  const sessionId = useRef(`editor-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const initialized = useRef(false);
  if (!initialized.current) {
    initialized.current = true;
    _activeEditorSessionId = sessionId.current;
    useCampaignWizardStore.setState({
      campaignId: initialCampaignId,
      formData: initialData,
      selectedProfileIds: existingProfileIds,
      profileConfigs: existingConfig,
      currentStep: 1,
      loading: false,
      error: "",
      success: "",
      clientPopoverOpen: false,
      contactPopoverOpen: false,
      showFilters: false,
    });
  }

  // Al editar una campana existente, el asistente debe calcular con SU
  // margen congelado y no con el global.
  useEffect(() => {
    if (markup !== undefined) setMarkup(markup);
  }, [markup, setMarkup]);

  useEffect(() => {
    const mySessionId = sessionId.current;
    return () => {
      // Permitir re-inicialización si este componente se remonta (React Strict Mode)
      initialized.current = false;
      // Solo hacer reset si esta instancia sigue siendo la dueña del store.
      // Si otra instancia ya tomó control (navegación entre editores),
      // el _activeEditorSessionId ya no coincide y no limpiamos su estado.
      if (_activeEditorSessionId === mySessionId) {
        _activeEditorSessionId = null;
        reset();
      }
    };
  }, [reset]);

  // -------------------------------------------------------------------------
  // Session persistence — survives F5 (edit mode only)
  // -------------------------------------------------------------------------

  // After hydration: restore unsaved in-progress changes from sessionStorage.
  // Empty deps is intentional — only run once after the first client render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        campaignId?: string;
        formData?: CampaignData;
        selectedProfileIds?: string[];
        profileConfigs?: ProfileConfig[];
        currentStep?: WizardStep;
        showFilters?: boolean;
      };
      // Guard: only restore if it belongs to the same campaign.
      if (saved.campaignId !== initialCampaignId) return;
      useCampaignWizardStore.setState({
        ...saved,
        // Always reset transient / UI-only state.
        loading: false,
        error: "",
        success: "",
        clientPopoverOpen: false,
        contactPopoverOpen: false,
      });
    } catch {
      // sessionStorage unavailable or JSON parse error — silently ignore.
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Continuously write wizard state to sessionStorage so F5 can restore it.
  useEffect(() => {
    if (!storageKey) return;
    const unsubscribe = useCampaignWizardStore.subscribe((state) => {
      if (state.loading) return; // skip mid-save snapshots
      try {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            campaignId: state.campaignId,
            formData: state.formData,
            selectedProfileIds: state.selectedProfileIds,
            profileConfigs: state.profileConfigs,
            currentStep: state.currentStep,
            showFilters: state.showFilters,
          })
        );
      } catch {
        // QuotaExceededError or unavailable — silently ignore.
      }
    });
    return () => unsubscribe();
  }, [storageKey]);

  // -------------------------------------------------------------------------
  // Filters (hook depends on profiles prop — must stay in this component)
  // -------------------------------------------------------------------------
  const filters = useProfileFilters(profiles);

  // -------------------------------------------------------------------------
  // Helper: build a profile config from scratch or with existing data
  // -------------------------------------------------------------------------
  const createProfileConfig = useCallback(
    (profileId: string, existingConf?: ProfileConfig): ProfileConfig => {
      const profile = profiles.find((p) => p.id === profileId);
      const activePlatformFilters = filters.selectedPlatforms;
      const activeServiceFilters = filters.selectedServices;

      return {
        profileId,
        profileName: profile?.name || "",
        platforms:
          profile?.socialAccounts.map((sa) => {
            const existingPlatform = existingConf?.platforms.find(
              (p) => p.socialAccountId === sa.id
            );

            const hasMatchingServices =
              activeServiceFilters.length > 0 &&
              sa.services.some((s) => activeServiceFilters.includes(s.serviceType.id));

            const shouldSelectPlatform =
              (activePlatformFilters.length > 0 && activePlatformFilters.includes(sa.platform.id)) ||
              hasMatchingServices;

            return {
              socialAccountId: sa.id,
              platformId: sa.platform.id,
              platformName: sa.platform.displayName,
              username: sa.username,
              selected: existingPlatform?.selected ?? shouldSelectPlatform,
              services: sa.services.map((s): ServiceConfig => {
                const existingService = existingPlatform?.services.find(
                  (es) => es.profileServiceId === s.id
                );
                const shouldSelectService =
                  shouldSelectPlatform && activeServiceFilters.length > 0
                    ? activeServiceFilters.includes(s.serviceType.id)
                    : false;
                return {
                  profileServiceId: s.id,
                  serviceTypeId: s.serviceType.id,
                  serviceName: s.serviceType.displayName,
                  quantity: existingService?.quantity ?? (shouldSelectService ? 1 : 0),
                  basePrice: Number(s.price),
                };
              }).concat(construirCombo(existingPlatform)),
            };
          }) || [],
      };
    },
    [profiles, filters.selectedPlatforms, filters.selectedServices]
  );

  // -------------------------------------------------------------------------
  // Sync profile configs when selectedProfileIds changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    setProfileConfigs((prevConfigs: ProfileConfig[]) => {
      const currentIds = new Set(prevConfigs.map((c) => c.profileId));
      const newIds = new Set(selectedProfileIds);

      const hasNewProfiles = selectedProfileIds.some((id) => !currentIds.has(id));
      const hasRemovedProfiles = prevConfigs.some((c) => !newIds.has(c.profileId));
      const hasIncompleteConfigs = prevConfigs.some(
        (c) => c.platforms.length > 0 && !c.platforms[0]?.platformName
      );

      if (!hasNewProfiles && !hasRemovedProfiles && !hasIncompleteConfigs) {
        return prevConfigs;
      }

      return selectedProfileIds.map((profileId) => {
        const existingConf = prevConfigs.find((c) => c.profileId === profileId);
        if (existingConf && existingConf.platforms.length > 0 && existingConf.platforms[0].platformName) {
          return existingConf;
        }
        return createProfileConfig(profileId, existingConf);
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedProfileIds is primitive array; setProfileConfigs is stable
  }, [selectedProfileIds, createProfileConfig]);

  // -------------------------------------------------------------------------
  // Step validation
  // -------------------------------------------------------------------------
  const canProceedToStep2 = useMemo(() => {
    return (
      formData.name.trim() !== "" &&
      formData.clientId !== "" &&
      formData.clientContactId !== "" &&
      formData.budget !== "" &&
      parseInt(formData.budget, 10) > 0
    );
  }, [formData.name, formData.clientId, formData.clientContactId, formData.budget]);

  const canProceedToStep3 = useMemo(() => {
    return selectedProfileIds.length > 0;
  }, [selectedProfileIds.length]);

  const goToStep = useCallback(
    (step: WizardStep) => {
      if (step === 2 && !canProceedToStep2) {
        setError("Completa todos los campos requeridos antes de continuar");
        return;
      }
      if (step === 3 && !canProceedToStep3) {
        setError("Selecciona al menos un perfil antes de continuar");
        return;
      }
      setError("");
      setCurrentStep(step);
    },
    [canProceedToStep2, canProceedToStep3, setError, setCurrentStep]
  );

  // -------------------------------------------------------------------------
  // Profiles payload (ref to avoid stale closures in async handlers)
  // -------------------------------------------------------------------------
  const profilesPayload = useMemo(() => {
    return profileConfigs
      .filter((pc) => pc.platforms.some((p) => p.selected))
      .map((pc) => ({
        profileId: pc.profileId,
        platforms: pc.platforms
          .filter((p) => p.selected)
          .map((p) => ({
            socialAccountId: p.socialAccountId,
            services: p.services
              // Un combo entra si tiene precio; el resto, si tiene unidades.
              .filter((s) => (s.esCombo ? s.basePrice > 0 : s.quantity > 0))
              // Forma unica en vez de una union: el combo lleva precio y
              // el resto lleva tarifa de origen, pero el tipo es el mismo.
              .map((s) => ({
                esCombo: Boolean(s.esCombo),
                profileServiceId: s.esCombo
                  ? undefined
                  : s.profileServiceId ?? undefined,
                comboPrecio: s.esCombo ? s.basePrice : undefined,
                comboDescripcion: s.esCombo ? s.comboDescripcion : undefined,
                quantity: s.esCombo ? 1 : s.quantity,
              })),
          }))
          .filter((p) => p.services.length > 0),
      }))
      .filter((p) => p.platforms.length > 0);
  }, [profileConfigs]);

  const profilesPayloadRef = useRef(profilesPayload);
  profilesPayloadRef.current = profilesPayload;

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------
  const validateFormData = () => {
    if (!formData.name.trim()) throw new Error("El nombre es requerido");
    if (!formData.clientId) throw new Error("Seleccione un cliente");
    if (!formData.clientContactId) throw new Error("Seleccione un contacto");
    if (!formData.budget || parseInt(formData.budget, 10) <= 0) {
      throw new Error("El presupuesto debe ser mayor a 0");
    }
  };

  // -------------------------------------------------------------------------
  // Async handlers (need router — stay in this component)
  // -------------------------------------------------------------------------
  const handleSave = async (sendToReview: boolean = false) => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      validateFormData();

      let currentCampaignId = campaignId;
      const payload = buildCampaignPayload(formData);

      if (!currentCampaignId) {
        const result = await createCampaignApi(payload);
        currentCampaignId = result.id;
        setCampaignId(currentCampaignId);
      } else {
        await updateCampaign(currentCampaignId!, payload);
      }

      const currentPayload = profilesPayloadRef.current;
      await saveCampaignProfiles(currentCampaignId!, currentPayload);

      if (sendToReview) {
        if (currentPayload.length === 0) {
          throw new Error("Agrega al menos un perfil para enviar a revision");
        }
        await updateCampaignStatus(currentCampaignId!, "REVIEW");
        setSuccess("Campana enviada a revision exitosamente");
      } else {
        setSuccess("Campana guardada exitosamente");
      }

      // Clear persisted draft now that changes are safely in the database.
      if (storageKey) {
        try { sessionStorage.removeItem(storageKey); } catch {}
      }

      onSaveSuccess?.();
      router.push(`/campaigns/${currentCampaignId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const handleActivateDirectly = async (reason: string) => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      validateFormData();

      const currentPayload = profilesPayloadRef.current;
      if (currentPayload.length === 0) {
        throw new Error("Agrega al menos un perfil para activar la campana");
      }

      let currentCampaignId = campaignId;
      const payload = buildCampaignPayload(formData);

      if (!currentCampaignId) {
        const result = await createCampaignApi(payload);
        currentCampaignId = result.id;
        setCampaignId(currentCampaignId);
      } else {
        await updateCampaign(currentCampaignId!, payload);
      }

      await saveCampaignProfiles(currentCampaignId!, currentPayload);
      await updateCampaignStatus(currentCampaignId!, "ACTIVE", reason || undefined);
      setSuccess("Campana activada exitosamente");

      // Clear persisted draft now that changes are safely in the database.
      if (storageKey) {
        try { sessionStorage.removeItem(storageKey); } catch {}
      }

      onSaveSuccess?.();
      router.push(`/campaigns/${currentCampaignId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al activar");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Navigation callbacks
  // -------------------------------------------------------------------------
  const handlePrevious = useCallback(() => {
    setCurrentStep((currentStep - 1) as WizardStep);
  }, [currentStep, setCurrentStep]);

  const handleNext = useCallback(() => {
    goToStep((currentStep + 1) as WizardStep);
  }, [currentStep, goToStep]);

  const handleCancel = useCallback(() => {
    if (storageKey) {
      try { sessionStorage.removeItem(storageKey); } catch {}
    }
    router.push("/campaigns");
  }, [router, storageKey]);

  // -------------------------------------------------------------------------
  // Context value (server data + callbacks)
  // -------------------------------------------------------------------------
  const contextValue = useMemo(
    () => ({
      clients,
      profiles,
      currentStatus,
      filters,
      onSave: handleSave,
      onActivateDirectly: handleActivateDirectly,
      onPrevious: handlePrevious,
      onNext: handleNext,
      onCancel: handleCancel,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleSave/handleActivateDirectly intentionally excluded to prevent infinite re-renders
    [clients, profiles, currentStatus, filters, handlePrevious, handleNext, handleCancel]
  );

  // -------------------------------------------------------------------------
  // Render — 1 provider instead of 4
  // -------------------------------------------------------------------------
  return (
    <CampaignWizardProvider value={contextValue}>
      <div className="space-y-6">
        <CampaignWizardSteps currentStep={currentStep} onStepClick={goToStep} />

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}

        <div className="min-h-[400px]">
          {currentStep === 1 && <CampaignStepDetails />}
          {currentStep === 2 && <CampaignStepProfiles />}
          {currentStep === 3 && <CampaignStepSummary />}
        </div>

        {currentStep !== 3 && <CampaignNavigationBar />}

        {currentStep === 3 && (
          <div className="flex justify-center pt-4 border-t">
            <Button variant="outline" onClick={() => setCurrentStep(2)} disabled={loading}>
              <ChevronLeft className="h-4 w-4 mr-2" /> Volver a Perfiles
            </Button>
          </div>
        )}
      </div>
    </CampaignWizardProvider>
  );
}
