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
  filters: Pick<UseProfileFiltersReturn, "selectedPlatforms" | "selectedServices">,
  /**
   * La configuracion tal como la trajo el servidor.
   *
   * Es la unica fuente fiable para reparar un estado corrupto: lo que
   * haya en el store puede venir de sessionStorage y estar vacio. Ver el
   * efecto de mas abajo.
   */
  configDelServidor: ProfileConfig[] = []
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
    /**
     * Los ids VIVOS, no los de la instantanea de render.
     *
     * CampaignEditor inicializa el store durante su propio render, y
     * useSyncExternalStore conserva la instantanea anterior durante esa
     * misma pasada: este efecto corria una primera vez creyendo que no
     * habia ningun influencer elegido. Como prevConfigs si traia la
     * configuracion recien cargada, la daba por "quitada" y la borraba;
     * en la segunda pasada ya no quedaba nada que reaprovechar y se
     * reconstruia desde el catalogo, con las plataformas sin marcar y
     * las cantidades a cero.
     *
     * El efecto se veia asi: abrir una campana guardada mostraba al
     * influencer elegido pero sin formatos, total 0, y guardar mandaba
     * `profiles: []` —es decir, abrir el editor y guardar sin tocar
     * nada se llevaba por delante la linea contratada entera, con sus
     * entregas y sus metricas.
     *
     * getState() dentro del efecto siempre devuelve lo que el store
     * tiene de verdad. La dependencia sigue siendo la instantanea, que
     * es lo que dice CUANDO volver a mirar.
     */
    const idsVivos = useCampaignWizardStore.getState().selectedProfileIds;

    /**
     * Una config sirve cuando tiene redes Y esas redes vienen resueltas
     * contra el catalogo (de ahi sale `platformName`). Lo que llega de
     * la base viene a medias, sin nombre de red, y hay que completarlo.
     */
    const estaResuelta = (c: ProfileConfig) =>
      c.platforms.length > 0 && Boolean(c.platforms[0]?.platformName);

    /**
     * Reparable = no sirve, y el catalogo YA tiene con que arreglarla.
     *
     * La segunda mitad es la que importa. Si el catalogo todavia no
     * conoce al perfil, reconstruir produce una config sin una sola red,
     * y una config sin redes no se podia volver a detectar: la condicion
     * anterior era `platforms.length > 0 && !platformName`, que con
     * `platforms: []` es falsa. Es decir, se quedaba rota para siempre
     * —y sessionStorage la devolvia intacta en cada apertura, tambien
     * despues de desplegar el arreglo del martes.
     *
     * Lo que se veia: el creador marcado, su tarjeta con el nombre pero
     * sin ninguna red debajo, «Total Formatos $0», y al guardar un envio
     * vacio que retiraba o borraba a todo el reparto.
     */
    const esReparable = (c: ProfileConfig) => {
      if (estaResuelta(c)) return false;
      const delCatalogo = profiles.find((p) => p.id === c.profileId);
      return Boolean(delCatalogo && delCatalogo.socialAccounts.length > 0);
    };

    setProfileConfigs((prevConfigs: ProfileConfig[]) => {
      const currentIds = new Set(prevConfigs.map((c) => c.profileId));
      const newIds = new Set(idsVivos);

      const hasNewProfiles = idsVivos.some((id) => !currentIds.has(id));
      const hasRemovedProfiles = prevConfigs.some((c) => !newIds.has(c.profileId));
      const hasIncompleteConfigs = prevConfigs.some(esReparable);

      if (!hasNewProfiles && !hasRemovedProfiles && !hasIncompleteConfigs) {
        return prevConfigs;
      }

      return idsVivos.map((profileId) => {
        const existingConf = prevConfigs.find((c) => c.profileId === profileId);
        if (existingConf && estaResuelta(existingConf)) return existingConf;

        /**
         * De donde se reconstruye. Una config sin redes no conserva ni
         * una seleccion ni un precio, asi que reaprovecharla equivale a
         * empezar de cero con todo desmarcado. Cuando eso pasa, la
         * fuente buena es lo que trajo el servidor, que es lo que la
         * campana tiene contratado de verdad.
         */
        const base =
          existingConf && existingConf.platforms.length > 0
            ? existingConf
            : configDelServidor.find((c) => c.profileId === profileId) ?? existingConf;

        return createProfileConfig(profileId, base);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedProfileIds is primitive array; setProfileConfigs is stable
  }, [selectedProfileIds, createProfileConfig]);
}
