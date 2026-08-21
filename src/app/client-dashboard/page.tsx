import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Building2, CalendarDays, Users } from "lucide-react";
import {
  COOKIE_SESION_CLIENTE,
  verificarSesionCliente,
} from "@/lib/client-session";
import { getCampaignsForClientPortal } from "@/data-access/campaigns";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_COLORS,
} from "@/lib/campaign-utils";
import { formatNumber } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CerrarSesionCliente } from "@/components/clients/cerrar-sesion-cliente";

function formatearFecha(fecha: Date | null) {
  return fecha
    ? new Intl.DateTimeFormat("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(fecha)
    : null;
}

/**
 * Contenido real del portal, dependiente de la sesion.
 *
 * Va dentro de un <Suspense> por obligacion: con cacheComponents
 * activado, leer cookies() y consultar la base fuera de un limite de
 * suspension rompe el build con "Uncached data was accessed outside of
 * <Suspense>". Ademas, durante el "docker build" no hay base de datos.
 *
 * Se vuelve a validar la sesion aunque el middleware ya proteja la ruta
 * (RUTA_CLIENTE en src/lib/auth.config.ts): de aqui sale el clientId
 * con el que se consulta, y ese dato tiene que venir de la cookie
 * firmada, no de nada que el navegador pueda manipular.
 */
async function ContenidoPortal() {
  const almacen = await cookies();
  const sesion = await verificarSesionCliente(
    almacen.get(COOKIE_SESION_CLIENTE)?.value
  );

  if (!sesion) {
    redirect("/client-login");
  }

  const campaigns = await getCampaignsForClientPortal(sesion.clientId);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2">
            <Building2 className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {sesion.companyName}
            </h1>
            <p className="text-sm text-gray-500">{sesion.email}</p>
          </div>
        </div>
        <CerrarSesionCliente />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tus campañas</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              Todavía no hay campañas para mostrar. Cuando tu equipo de cuenta
              envíe una a revisión, aparecerá aquí.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {campaigns.map((campaign) => (
                <li key={campaign.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      {/* Enlace a los resultados: links publicados y su
                          impacto. La pagina vuelve a comprobar que la
                          campana sea de este cliente. */}
                      <Link
                        href={`/client-dashboard/${campaign.id}`}
                        className="font-medium text-gray-900 hover:text-blue-700 hover:underline"
                      >
                        {campaign.name}
                      </Link>
                      {campaign.description && (
                        <p className="mt-1 text-sm text-gray-500">
                          {campaign.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {campaign.totalProfiles}{" "}
                          {campaign.totalProfiles === 1
                            ? "creador"
                            : "creadores"}
                        </span>
                        {formatearFecha(campaign.startDate) && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatearFecha(campaign.startDate)}
                            {formatearFecha(campaign.endDate)
                              ? ` – ${formatearFecha(campaign.endDate)}`
                              : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          CAMPAIGN_STATUS_COLORS[campaign.status] ??
                          "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {CAMPAIGN_STATUS_LABELS[campaign.status] ??
                          campaign.status}
                      </span>
                      <span className="whitespace-nowrap text-sm font-medium text-gray-900">
                        ${formatNumber(campaign.budget.split(".")[0])}{" "}
                        {campaign.currency}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function PortalCargando() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-12 animate-pulse rounded-lg bg-gray-200" />
      <div className="h-48 animate-pulse rounded-lg bg-gray-200" />
    </div>
  );
}

/**
 * Portal de clientes.
 *
 * Ruta publica en cuanto a middleware de personal, pero protegida por
 * la sesion de cliente: /client-dashboard figura en el matcher de
 * src/middleware.ts y lo atiende el callback authorized.
 */
export default function ClientDashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <Suspense fallback={<PortalCargando />}>
          <ContenidoPortal />
        </Suspense>
      </div>
    </div>
  );
}
