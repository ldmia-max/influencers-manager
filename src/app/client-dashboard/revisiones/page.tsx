import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CalendarDays, ClipboardCheck, AlertCircle } from "lucide-react";
import {
  COOKIE_SESION_CLIENTE,
  verificarSesionCliente,
} from "@/lib/client-session";
import { revisionesPendientesDeCliente } from "@/data-access/campaigns";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_COLORS,
} from "@/lib/campaign-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatearFecha(fecha: Date | null) {
  return fecha
    ? new Intl.DateTimeFormat("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(fecha)
    : null;
}

const AVISOS: Record<string, string> = {
  "sin-pendientes":
    "Esa campaña ya no tiene nada pendiente de revisar. Es posible que alguien de tu equipo la haya respondido antes.",
  error: "No se pudo abrir la revisión. Vuelve a intentarlo en un momento.",
};

/**
 * Las revisiones pendientes del cliente.
 *
 * Dentro de <Suspense> por lo de siempre: con cacheComponents, leer
 * cookies() o searchParams fuera de un limite de suspension rompe el
 * build, y durante el "docker build" no hay base de datos.
 */
async function Contenido({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>;
}) {
  const { aviso } = await searchParams;
  const almacen = await cookies();
  const sesion = await verificarSesionCliente(
    almacen.get(COOKIE_SESION_CLIENTE)?.value
  );

  if (!sesion) {
    redirect("/client-login");
  }

  const campanas = await revisionesPendientesDeCliente(sesion.clientId);
  const textoAviso = aviso ? AVISOS[aviso] : null;

  return (
    <>
      {textoAviso && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{textoAviso}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pendientes de revisar</CardTitle>
        </CardHeader>
        <CardContent>
          {campanas.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              No tienes nada pendiente de revisar. Cuando tu equipo de cuenta te
              envíe una propuesta, aparecerá aquí.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {campanas.map((c) => (
                <li key={c.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/client-dashboard/${c.id}`}
                        className="font-medium text-gray-900 hover:text-blue-700 hover:underline"
                      >
                        {c.name}
                      </Link>
                      {c.description && (
                        <p className="mt-1 text-sm text-gray-500">
                          {c.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <ClipboardCheck className="h-3.5 w-3.5" />
                          {c.pendientes}{" "}
                          {c.pendientes === 1
                            ? "creador por revisar"
                            : "creadores por revisar"}
                        </span>
                        {formatearFecha(c.startDate) && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatearFecha(c.startDate)}
                            {formatearFecha(c.endDate)
                              ? ` – ${formatearFecha(c.endDate)}`
                              : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          CAMPAIGN_STATUS_COLORS[c.status] ??
                          "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {CAMPAIGN_STATUS_LABELS[c.status] ?? c.status}
                      </span>
                      {/* Enlace normal y no un boton con fetch: la ruta
                          resuelve el token, deja puesta la cookie de
                          aprobacion y redirige. Es navegacion. */}
                      <Button asChild size="sm">
                        <a href={`/api/client-portal/revisar/${c.id}`}>
                          Revisar
                        </a>
                      </Button>
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

function Cargando() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-48 animate-pulse rounded-lg bg-gray-200" />
    </div>
  );
}

export default function RevisionesPage({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>;
}) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Suspense fallback={<Cargando />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
