"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Search, UserPlus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatNumber } from "@/lib/format";
import { calculateMarkupPrice } from "@/lib/campaign-utils";
import { apiGet, apiPost, apiPatch } from "@/services/api";

interface ServicioCatalogo {
  id: string;
  price: string | number;
  serviceType: { id: string; displayName: string };
}

interface CuentaCatalogo {
  id: string;
  username: string;
  platform: { id: string; displayName: string };
  services: ServicioCatalogo[];
}

interface PerfilCatalogo {
  id: string;
  name: string;
  socialAccounts: CuentaCatalogo[];
}

export interface PendienteVista {
  campaignProfileId: string;
  nombre: string;
}

interface Props {
  campaignId: string;
  /** Lo que liberaron los retirados: el dinero disponible para reemplazar. */
  presupuestoLiberado: number;
  /** Influencers añadidos que esperan el visto bueno del cliente. */
  pendientes: PendienteVista[];
  /** Ids ya en la campaña, para no ofrecerlos. */
  yaEnCampana: string[];
  markup: number;
}

/**
 * Sustituir a un influencer que se retiro de una campana ya en marcha.
 *
 * Solo anade. La edicion completa sigue cerrada en campanas activas a
 * proposito: ahi se podrian cambiar precios que el cliente aprobo o
 * borrar a alguien que ya entrego contenido.
 */
export function ReemplazarInfluencer({
  campaignId,
  presupuestoLiberado,
  pendientes,
  yaEnCampana,
  markup,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<PerfilCatalogo[]>([]);
  const [elegido, setElegido] = useState<PerfilCatalogo | null>(null);
  const [seleccion, setSeleccion] = useState<Record<string, boolean>>({});
  const [guardando, setGuardando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refrescar = () => startTransition(() => router.refresh());

  const buscar = async () => {
    setBuscando(true);
    setError(null);
    try {
      const datos = await apiGet<{ profiles?: PerfilCatalogo[] } | PerfilCatalogo[]>(
        `/api/profiles?search=${encodeURIComponent(busqueda)}&limit=20`
      );
      const lista = Array.isArray(datos) ? datos : datos.profiles ?? [];
      // Quien ya está en la campaña no se ofrece: añadirlo dos veces no
      // tiene sentido y el servidor lo rechazaría igualmente.
      setResultados(lista.filter((p) => !yaEnCampana.includes(p.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo buscar");
    } finally {
      setBuscando(false);
    }
  };

  /** Formatos marcados, agrupados por cuenta, como los espera el API. */
  const construirPlataformas = () => {
    if (!elegido) return [];
    return elegido.socialAccounts
      .map((cuenta) => ({
        socialAccountId: cuenta.id,
        services: cuenta.services
          .filter((s) => seleccion[s.id])
          .map((s) => ({ profileServiceId: s.id, quantity: 1 })),
      }))
      .filter((p) => p.services.length > 0);
  };

  const totalElegido = elegido
    ? elegido.socialAccounts
        .flatMap((c) => c.services)
        .filter((s) => seleccion[s.id])
        .reduce((suma, s) => suma + calculateMarkupPrice(Number(s.price), markup), 0)
    : 0;

  const anadir = async () => {
    if (!elegido) return;
    const platforms = construirPlataformas();
    if (platforms.length === 0) {
      setError("Selecciona al menos un formato");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await apiPost(`/api/campaigns/${campaignId}/influencers`, {
        profileId: elegido.id,
        platforms,
      });
      setAbierto(false);
      setElegido(null);
      setSeleccion({});
      setResultados([]);
      setBusqueda("");
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
        <Button size="sm" variant="outline" onClick={() => setAbierto(true)}>
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
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Añadir influencer a la campaña</DialogTitle>
            <DialogDescription>
              Entrará pendiente de aprobación. Los precios se toman del tarifario
              del influencer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                buscar();
              }}
              className="flex gap-2"
            >
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar influencer por nombre…"
                autoFocus
              />
              <Button type="submit" variant="outline" disabled={buscando}>
                {buscando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </form>

            {!elegido && resultados.length > 0 && (
              <ul className="max-h-56 space-y-1 overflow-y-auto">
                {resultados.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setElegido(p);
                        setSeleccion({});
                      }}
                      className="w-full rounded-lg border border-gray-200 p-3 text-left text-sm hover:border-violet-300"
                    >
                      <span className="font-medium text-gray-900">{p.name}</span>
                      <span className="ml-2 text-xs text-gray-500">
                        {p.socialAccounts.map((c) => c.platform.displayName).join(", ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!elegido && !buscando && resultados.length === 0 && busqueda && (
              <p className="text-sm text-gray-500">
                Sin resultados. Prueba con otro nombre.
              </p>
            )}

            {elegido && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900">{elegido.name}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setElegido(null);
                      setSeleccion({});
                    }}
                  >
                    Cambiar
                  </Button>
                </div>

                {elegido.socialAccounts.map((cuenta) => (
                  <div key={cuenta.id} className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">
                      @{cuenta.username} · {cuenta.platform.displayName}
                    </p>
                    {cuenta.services.length === 0 ? (
                      <p className="mt-1 text-xs text-gray-400">
                        Sin formatos con precio en esta cuenta
                      </p>
                    ) : (
                      <div className="mt-2 space-y-1">
                        {cuenta.services.map((s) => (
                          <div key={s.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`svc-${s.id}`}
                              checked={!!seleccion[s.id]}
                              onCheckedChange={(v) =>
                                setSeleccion((prev) => ({ ...prev, [s.id]: v === true }))
                              }
                            />
                            <Label
                              htmlFor={`svc-${s.id}`}
                              className="flex flex-1 cursor-pointer justify-between text-sm"
                            >
                              <span>{s.serviceType.displayName}</span>
                              <span className="text-gray-600">
                                $
                                {formatNumber(
                                  Math.round(
                                    calculateMarkupPrice(Number(s.price), markup)
                                  )
                                )}
                              </span>
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {totalElegido > 0 && (
                  <div className="flex justify-between rounded-lg bg-violet-50 p-3 text-sm">
                    <span className="text-violet-900">Coste para el cliente</span>
                    <span className="font-semibold text-violet-900">
                      ${formatNumber(Math.round(totalElegido))}
                    </span>
                  </div>
                )}

                {presupuestoLiberado > 0 && totalElegido > presupuestoLiberado && (
                  <p className="text-xs text-amber-700">
                    Supera en $
                    {formatNumber(Math.round(totalElegido - presupuestoLiberado))} lo
                    que liberaron los retiros. Se puede añadir igual, pero subirá el
                    total de la campaña.
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={anadir} disabled={!elegido || guardando}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Añadir a la campaña
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
