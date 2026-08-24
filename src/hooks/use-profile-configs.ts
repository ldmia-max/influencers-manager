import { useCallback, useEffect } from "react";
import { useCampaignWizardStore } from "@/stores/campaign-wizard-store";
import type {
  PlatformConfig,
  ProfileConfig,
  ProfileWithServices,
  ServiceConfig,
} from "@/models/campaign";
import type { UseProfileFiltersReturn } from "./use-profile-filters";

/**
 * Construye la configuracion de formatos de cada influencer elegido.
 *
 * Vivia dentro de CampaignEditor, y por eso el modal de sustitucion
 * —que monta el mismo paso de perfiles pero sin el editor alrededor—
 * marcaba influencers sin que apareciera nada en el panel derecho:
 * `selectedProfileIds` crecia y `profileConfigs` se quedaba vacio.
 *
 * Al extraerlo, quien quiera reutilizar CampaignStepProfiles solo tiene
 * que llamar a este hook. Duplicar la logica habria dejado dos versiones
 * que tarde o temprano dejan de coincidir.
 */

/**
 * Clave sintetica del combo dentro de una plataforma.
 *
 * El combo no sale del tarifario, asi que no tiene profileServiceId. El
 * store identifica cada servicio por `profileServiceId ?? serviceTypeId`,
 * y este valor ocupa ese segundo hueco.
 */
export const COMBO_ID = "__combo__";

/**
 * Fila de combo que se anade a cada plataforma.
 *
 * Se inyecta en la interfaz en vez de guardarse en el tarifario del
 * influencer: un combo es un acuerdo puntual de UNA campana, y crear una
 * tarifa "Combo $0" en cada creador seria informacion falsa.
 */
export function construirCombo(
  existingPlatform: PlatformConfig | undefined
): ServiceConfig[] {
  const previo = existingPlatform?.services.find((s) => s.esCombo);
  return [
    {
      profileServiceId: null,
      serviceTypeId: COMBO_ID,
      serviceName: "Combo",
      // Nace apagado; solo viene activo si la campana ya tenia combo.
      quantity: previo && previo.basePrice > 0 ? 1 : 0,
      basePrice: previo?.basePrice ?? 0,
      esCombo: true,
      comboDescripcion: previo?.comboDescripcion ?? "",
    },
  ];
}

export function useProfileConfigs(
  profiles: ProfileWithServices[],
  filters: Pick<UseProfileFiltersReturn, "selectedPlatforms" | "selectedServices">
) {
  const selectedProfileIds = useCampaignWizardStore((s) => s.selectedProfileIds);
  const setProfileConfigs = useCampaignWizardStore((s) => s.setProfileConfigs);

  const { selectedPlatforms, selectedServices } = filters;

  const createProfileConfig = useCallback(
    (profileId: string, existingConf?: ProfileConfig): ProfileConfig => {
      const profile = profiles.find((p) => p.id === profileId);

      return {
        profileId,
        profileName: profile?.name || "",
        platforms:
          profile?.socialAccounts.map((sa) => {
            const existingPlatform = existingConf?.platforms.find(
              (p) => p.socialAccountId === sa.id
            );

            const hasMatchingServices =
              selectedServices.length > 0 &&
              sa.services.some((s) => selectedServices.includes(s.serviceType.id));

            const shouldSelectPlatform =
              (selectedPlatforms.length > 0 && selectedPlatforms.includes(sa.platform.id)) ||
              hasMatchingServices;

            return {
              socialAccountId: sa.id,
              platformId: sa.platform.id,
              platformName: sa.platform.displayName,
              username: sa.username,
              selected: existingPlatform?.selected ?? shouldSelectPlatform,
              services: sa.services
                .map((s): ServiceConfig => {
                  const existingService = existingPlatform?.services.find(
                    (es) => es.profileServiceId === s.id
                  );
                  const shouldSelectService =
                    shouldSelectPlatform && selectedServices.length > 0
                      ? selectedServices.includes(s.serviceType.id)
                      : false;
                  return {
                    profileServiceId: s.id,
                    serviceTypeId: s.serviceType.id,
                    serviceName: s.serviceType.displayName,
                    quantity: existingService?.quantity ?? (shouldSelectService ? 1 : 0),
                    basePrice: Number(s.price),
                  };
                })
                .concat(construirCombo(existingPlatform)),
            };
          }) || [],
      };
    },
    [profiles, selectedPlatforms, selectedServices]
  );

  useEffect(() => {
    setProfileConfigs((prevConfigs: ProfileConfig[]) => {
      const currentIds = new Set(prevConfigs.map((c) => c.profileId));
      const newIds = new Set(selectedProfileIds);

      const hasNewProfiles = selectedProfileIds.some((id) => !currentIds.has(id));
      const hasRemovedProfiles = prevConfigs.some((c) => !newIds.has(c.profileId));
      // Una config a medio construir —sin nombre de plataforma— viene de
      // la base de datos y hay que completarla con el catalogo.
      const hasIncompleteConfigs = prevConfigs.some(
        (c) => c.platforms.length > 0 && !c.platforms[0]?.platformName
      );

      if (!hasNewProfiles && !hasRemovedProfiles && !hasIncompleteConfigs) {
        return prevConfigs;
      }

      return selectedProfileIds.map((profileId) => {
        const existingConf = prevConfigs.find((c) => c.profileId === profileId);
        if (
          existingConf &&
          existingConf.platforms.length > 0 &&
          existingConf.platforms[0].platformName
        ) {
          return existingConf;
        }
        return createProfileConfig(profileId, existingConf);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedProfileIds is primitive array; setProfileConfigs is stable
  }, [selectedProfileIds, createProfileConfig]);
}
