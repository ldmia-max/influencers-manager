"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, UserPlus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CampaignWizardProvider } from "@/contexts/campaign-wizard-context";
import { useCampaignWizardStore } from "@/stores/campaign-wizard-store";
import { useProfileFilters } from "@/hooks/use-profile-filters";
import { useProfileConfigs } from "@/hooks/use-profile-configs";
import { CampaignStepProfiles } from "./campaign-step-profiles";
import { formatNumber } from "@/lib/format";
import { apiPost, apiPatch } from "@/services/api";
import type { ProfileWithServices } from "@/models/campaign";

export interface PendienteVista {
  campaignProfileId: string;
  nombre: string;
}

interface Props {
  campaignId: string;
  /** Catálogo de influencers, ya sin los que están en la campaña. */
  profiles: ProfileWithServices[];
  /** Lo que liberaron los retiros: el dinero disponible para reemplazar. */
  presupuestoLiberado: number;
  /** Lo que ya cuesta la campaña, para no pasarse del presupuesto. */
  totalActual: number;
  presupuesto: number;
  pendientes: PendienteVista[];
  markup: number;
}

/**
 * Sustituir a un influencer que se retiro de una campana ya en marcha.
 *
 * Solo anade. La edicion completa sigue cerrada en campanas activas a
 * proposito: ahi se podrian cambiar precios que el cliente aprobo o
 * borrar a alguien que ya entrego contenido.
 *
 * Por dentro reutiliza el paso de perfiles del editor —el mismo buscador,
 * la misma configuracion de formatos y la misma barra de presupuesto— en
 * lugar de una pantalla propia. Dos formas distintas de elegir
 * influencers en la misma aplicacion se acaban comportando distinto, y
 * ademas aquella no mostraba ni los combos ni el alcance.
 */
export function ReemplazarInfluencer({
  campaignId,
  profiles,
  presupuestoLiberado,
  totalActual,
  presupuesto,
  pendientes,
  markup,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filters = useProfileFilters(profiles);

  // Sin esto se podia marcar un influencer y el panel derecho seguia
  // vacio: quien construye su configuracion de formatos es este hook.
  useProfileConfigs(profiles, filters);

  const profileConfigs = useCampaignWizardStore((s) => s.profileConfigs);
  const selectedProfileIds = useCampaignWizardStore((s) => s.selectedProfileIds);
  const reset = useCampaignWizardStore((s) => s.reset);

  const refrescar = () => startTransition(() => router.refresh());

  /**
   * El asistente arranca vacio y con el presupuesto que QUEDA, no con el
   * total de la campana: aqui solo se esta anadiendo, y la barra tiene
   * que medir contra lo que de verdad hay libre.
   */
  useEffect(() => {
    if (!abierto) return;
    reset();
    useCampaignWizardStore.setState({
      campaignId,
      markup,
      selectedProfileIds: [],
      profileConfigs: [],
      formData: {
        name: "",
        description: "",
        clientId: "",
        clientContactId: "",
        budget: String(Math.max(0, Math.round(presupuesto - totalActual))),
        startDate: "",
        endDate: "",
      },
      currentStep: 2,
      showFilters: true,
    });
  }, [abierto, campaignId, markup, presupuesto, totalActual, reset]);

  /** Lo elegido, en la forma que espera el API. */
  const aEnviar = useMemo(() => {
    return profileConfigs
      .filter((c) => selectedProfileIds.includes(c.profileId))
      .map((c) => ({
        profileId: c.profileId,
        platforms: c.platforms
          .filter((p) => p.selected)
          .map((p) => ({
            socialAccountId: p.socialAccountId,
            services: p.services
              .filter((s) => (s.esCombo ? s.basePrice > 0 : s.quantity > 0))
              .map((s) =>
                s.esCombo
                  ? {
                      quantity: 1,
                      esCombo: true,
                      comboPrecio: s.basePrice,
                      comboDescripcion: s.comboDescripcion,
                    }
                  : {
                      profileServiceId: s.profileServiceId,
                      quantity: s.quantity,
                    }
              ),
          }))
          .filter((p) => p.services.length > 0),
      }))
      .filter((c) => c.platforms.length > 0);
  }, [profileConfigs, selectedProfileIds]);

  const anadir = async () => {
    if (aEnviar.length === 0) {
      setError("Selecciona al menos un influencer con sus formatos");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      // Uno por uno: si el segundo falla, el primero ya quedo guardado y
      // el mensaje dice cual fue. Un lote que se deshace entero obligaria
      // a rehacer la seleccion desde cero.
      for (const perfil of aEnviar) {
        await apiPost(`/api/campaigns/${campaignId}/influencers`, perfil);
      }
      setAbierto(false);
      reset();
      refrescar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo añadir");
    } finally {
      setGuardando(false);
    }
  };

  const aprobar = async (campaignProfileId: string) => {
    setOcupado(campaignProfileId);
    setError(null);
    try {
      await apiPatch(
        `/api/campaigns/${campaignId}/influencers/${campaignProfileId}`,
        {}
      );
      refrescar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo aprobar");
    } finally {
      setOcupado(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4" />
            Sustituciones
          </CardTitle>
          {presupuestoLiberado > 0 && (
            <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
              <Wallet className="h-3.5 w-3.5" />
              Se liberaron{" "}
              <span className="font-semibold text-gray-800">
                ${formatNumber(Math.round(presupuestoLiberado))}
              </span>{" "}
              con los retiros
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setError(null);
            setAbierto(true);
          }}
        >
          <UserPlus className="mr-2 h-3.5 w-3.5" />
          Añadir influencer
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {error && !abierto && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {pendientes.length === 0 ? (
          <p className="text-xs text-gray-500">
            Si un influencer se retira, aquí puedes contratar a otro sin cancelar
            la campaña. El nuevo queda pendiente de aprobación.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              Esperando el visto bueno. Envíaselo al cliente con el enlace de
              aprobación, o apruébalo tú si tienes esa decisión delegada.
            </p>
            {pendientes.map((p) => (
              <div
                key={p.campaignProfileId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{p.nombre}</span>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                    Pendiente de aprobación
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={ocupado === p.campaignProfileId}
                  onClick={() => aprobar(p.campaignProfileId)}
                >
                  {ocupado === p.campaignProfileId ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                  )}
                  Aprobar sin el cliente
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="flex h-[92vh] max-w-[95vw] flex-col gap-0 p-0 xl:max-w-[1400px]">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>Añadir influencer a la campaña</DialogTitle>
            <DialogDescription>
              Entrará pendiente de aprobación. El presupuesto que ves es el que
              queda libre en esta campaña.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* El mismo paso del editor: buscador, configuración de formatos
              y barra de presupuesto. */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <CampaignWizardProvider
              value={{
                profiles,
                filters,
                // El resto del contexto no aplica: aqui no hay pasos que
                // navegar ni un guardado de asistente. Los botones del
                // modal hacen su propio trabajo.
                clients: [],
                currentStatus: "ACTIVE",
                onSave: () => {},
                onActivateDirectly: () => {},
                onPrevious: () => {},
                onNext: () => {},
                onCancel: () => setAbierto(false),
              }}
            >
              <CampaignStepProfiles />
            </CampaignWizardProvider>
          </div>

          <BarraPresupuesto />

          <div className="flex justify-end gap-2 border-t px-6 py-4">
            <Button variant="outline" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={anadir} disabled={guardando || aEnviar.length === 0}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {aEnviar.length > 1
                ? `Añadir ${aEnviar.length} influencers`
                : "Añadir a la campaña"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/**
 * Barra de presupuesto del modal.
 *
 * No se reutiliza CampaignNavigationBar porque esa lleva ademas los
 * botones de navegacion entre pasos del asistente, y aqui no hay pasos.
 */
function BarraPresupuesto() {
  const disponible = useCampaignWizardStore((s) => s.getBudget());
  const total = useCampaignWizardStore((s) => s.getTotalServicesPrice());
  const perfiles = useCampaignWizardStore((s) => s.selectedProfileIds.length);

  const restante = disponible - total;
  const porcentaje = disponible > 0 ? Math.min((total / disponible) * 100, 100) : 0;
  const excede = restante < 0;

  return (
    <div className="border-t bg-white px-6 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-4">
          <span>
            <span className="text-xs text-gray-500">Libre en la campaña</span>
            <span className="ml-2 font-semibold">
              ${formatNumber(Math.round(disponible))}
            </span>
          </span>
          <span>
            <span className="text-xs text-gray-500">Seleccionado</span>
            <span
              className={`ml-2 font-semibold ${excede ? "text-red-600" : "text-green-600"}`}
            >
              ${formatNumber(Math.round(total))}
            </span>
          </span>
          <span>
            <span className="text-xs text-gray-500">
              {excede ? "Se pasa por" : "Quedaría"}
            </span>
            <span
              className={`ml-2 font-semibold ${excede ? "text-red-600" : "text-gray-700"}`}
            >
              ${formatNumber(Math.round(Math.abs(restante)))}
            </span>
          </span>
          <span>
            <span className="text-xs text-gray-500">Influencers</span>
            <span className="ml-2 font-semibold">{perfiles}</span>
          </span>
        </div>
        <span
          className={`text-xs font-medium ${excede ? "text-red-600" : "text-gray-500"}`}
        >
          {Math.round(porcentaje)}% de lo libre
        </span>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all ${
            excede ? "bg-red-500" : porcentaje > 80 ? "bg-amber-500" : "bg-green-500"
          }`}
          style={{ width: `${porcentaje}%` }}
        />
      </div>

      {excede && (
        <p className="mt-2 text-xs text-amber-700">
          Supera el presupuesto de la campaña. Se puede añadir igual, pero el
          total acordado con el cliente subirá.
        </p>
      )}
    </div>
  );
}
