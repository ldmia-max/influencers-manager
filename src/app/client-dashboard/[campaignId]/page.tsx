import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, DollarSign, User } from "lucide-react";
import {
  COOKIE_SESION_CLIENTE,
  verificarSesionCliente,
} from "@/lib/client-session";
import { getCampaignResultsForClient } from "@/data-access/campaigns";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_COLORS,
} from "@/lib/campaign-utils";
import { formatCompactNumber, formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  CampaignTabs,
  type PestanaCampana,
} from "@/components/campaigns/campaign-tabs";
import {
  MetricasCampana,
  type Publicacion,
} from "@/components/campaigns/metricas-campana";
import { PerfilesCampanaCliente } from "@/components/clients/perfiles-campana-cliente";
import { RevisionesCampanaCliente } from "@/components/clients/revisiones-campana-cliente";

function formatearFecha(fecha: Date | string | null): string {
  if (!fecha) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(fecha));
}

interface PageProps {
  params: Promise<{ campaignId: string }>;
}

/**
 * Una campana en el portal del cliente.
 *
 * Va dentro de <Suspense> por la misma razon que el listado: con
 * cacheComponents, leer cookies() y consultar la base fuera de un limite
 * de suspension rompe el build, y durante el "docker build" no hay base
 * de datos.
 *
 * La sesion se vuelve a verificar aunque el middleware ya proteja
 * /client-dashboard/:path*: de aqui sale el clientId con el que se
 * consulta, y ese dato tiene que venir de la cookie firmada.
 */
async function Contenido({ params }: PageProps) {
  // `params` se resuelve AQUI DENTRO, no en el componente de pagina.
  // Con cacheComponents, esperarlo fuera del limite de suspension rompe
  // el build con "Uncached data was accessed outside of <Suspense>":
  // los parametros de una ruta dinamica cuentan como dato no cacheado
  // igual que las cookies o una consulta.
  const { campaignId } = await params;
  const almacen = await cookies();
  const sesion = await verificarSesionCliente(
    almacen.get(COOKIE_SESION_CLIENTE)?.value
  );

  if (!sesion) {
    redirect("/client-login");
  }

  const campana = await getCampaignResultsForClient(sesion.clientId, campaignId);

  // Un 404 sin mas, tanto si la campana no existe como si es de otro
  // cliente: distinguir los dos casos le confirmaria a un curioso que
  // existe.
  if (!campana) {
    notFound();
  }

  const capturas = campana.profiles.flatMap((cp) =>
    cp.platforms.flatMap((cpp) =>
      cpp.services.flatMap((cs) =>
        cs.entregas.flatMap((e) =>
          e.metricas.map((m) => ({
            capturadoEn: m.capturadoEn.toISOString(),
            origen: m.origen,
            vistas: m.vistas,
            interacciones: m.interacciones,
            meGusta: m.meGusta,
            comentarios: m.comentarios,
            compartidos: m.compartidos,
            guardados: m.guardados,
            reposteos: m.reposteos,
            entregaId: e.id,
            url: e.url,
            formato: e.serviceType?.displayName ?? null,
            influencer: cp.profile.name,
            plataforma: cpp.socialAccount.platform.displayName,
            username: cpp.socialAccount.username,
          }))
        )
      )
    )
  );

  /**
   * Una entrada por entrega, con lo que ningun scraper lee.
   *
   * El portal recibe las mismas que la ficha de la agencia para que el
   * engagement salga igual en los dos sitios: sin el alcance, el
   * denominador caeria a las vistas y el cliente veria otro porcentaje
   * para la misma campana.
   */
  const publicaciones: Publicacion[] = campana.profiles.flatMap((cp) =>
    cp.platforms.flatMap((cpp) =>
      cpp.services.flatMap((cs) =>
        cs.entregas.map((e) => {
          const red =
            e.serviceType?.platform.name ?? cpp.socialAccount.platform.name;
          return {
            entregaId: e.id,
            influencer: cp.profile.name,
            plataforma:
              e.serviceType?.platform.displayName ??
              cpp.socialAccount.platform.displayName,
            username: cpp.socialAccount.username,
            url: e.url,
            formato:
              e.serviceType?.displayName ??
              (cs.esCombo
                ? "Combo"
                : (cs.profileService?.serviceType.displayName ?? null)),
            esInstagram: red.toLowerCase() === "instagram",
            admiteReposteos: red.toLowerCase() === "instagram",
            esEfimero: e.serviceType
              ? e.serviceType.esEfimero
              : !cs.esCombo &&
                (cs.profileService?.serviceType.esEfimero ?? false),
            alcance: e.alcance,
            compartidosReportados: e.compartidosReportados,
            reposteosReportados: e.reposteosReportados,
            esExtra: e.esExtra,
          };
        })
      )
    )
  );

  // Los seguidores y el dinero cuentan solo a quien sigue contratado: un
  // retirado se ve en Perfiles con su insignia, pero ya no suma ni a la
  // audiencia ni al total. Es la misma regla que aplica
  // calcularTotalCampana en la ficha de la agencia.
  const activos = campana.profiles.filter((cp) => cp.participacion === "ACTIVO");

  const totalSeguidores = activos.reduce(
    (suma, cp) =>
      suma +
      cp.platforms.reduce((s, p) => s + (p.socialAccount.followers ?? 0), 0),
    0
  );

  const totalContratado = activos.reduce(
    (suma, cp) =>
      suma +
      cp.platforms.reduce(
        (s, cpp) =>
          s + cpp.services.reduce((t, cs) => t + Number(cs.subtotal), 0),
        0
      ),
    0
  );

  const presupuesto = Number(campana.budget);
  const pendientes = activos.filter((cp) => cp.status === "PENDING").length;

  const pestanas: PestanaCampana[] = [
    {
      valor: "impacto",
      etiqueta: "Impacto del contenido",
      contenido: (
        // El cliente mira, no refresca: cada lectura consume crédito.
        <MetricasCampana
          campaignId={campana.id}
          capturas={capturas}
          publicaciones={publicaciones}
          seguidores={totalSeguidores}
        />
      ),
    },
    {
      valor: "perfiles",
      etiqueta: "Perfiles y formatos",
      contenido: <PerfilesCampanaCliente perfiles={campana.profiles} />,
    },
    {
      valor: "general",
      etiqueta: "General",
      contenido: (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardContent className="space-y-3 py-4">
                <span className="flex items-center gap-2 font-semibold">
                  <User className="h-5 w-5" />
                  Contacto
                </span>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <span className="font-medium">
                    {campana.clientContact.firstName}{" "}
                    {campana.clientContact.lastName}
                  </span>
                  {campana.clientContact.position && (
                    <span className="text-sm text-gray-500">
                      {campana.clientContact.position}
                    </span>
                  )}
                  <span className="text-sm text-gray-500">
                    {campana.clientContact.email}
                  </span>
                  {campana.clientContact.phone && (
                    <span className="text-sm text-gray-500">
                      {campana.clientContact.phone}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 py-4">
                <span className="flex items-center gap-2 font-semibold">
                  <Calendar className="h-5 w-5" />
                  Fechas
                </span>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <span className="text-sm">
                    <span className="text-gray-500">Inicio: </span>
                    {formatearFecha(campana.startDate)}
                  </span>
                  <span className="text-sm">
                    <span className="text-gray-500">Fin: </span>
                    {formatearFecha(campana.endDate)}
                  </span>
                  <span className="text-sm">
                    <span className="text-gray-500">Creada: </span>
                    {formatearFecha(campana.createdAt)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* El resumen economico del cliente: su presupuesto y lo que
              lleva contratado, con el margen ya dentro de cada importe.
              El margen en si NO se nombra, ni como porcentaje ni como
              precio base: para el cliente el numero contratado es el
              precio, no una base mas un recargo. */}
          <Card>
            <CardContent className="space-y-3 py-4">
              <span className="flex items-center gap-2 font-semibold">
                <DollarSign className="h-5 w-5" />
                Resumen
              </span>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Presupuesto:</span>
                  <span className="font-bold">
                    ${formatNumber(String(Math.round(presupuesto)))}{" "}
                    {campana.currency}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Contratado:</span>
                  <span className="font-medium tabular-nums">
                    ${formatNumber(String(Math.round(totalContratado)))}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Creadores:</span>
                  <span className="font-medium">{activos.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    Audiencia sumada:
                  </span>
                  <span className="font-medium">
                    {formatCompactNumber(totalSeguidores)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ),
    },
    {
      valor: "revisiones",
      etiqueta: "Revisiones",
      contenido: (
        <RevisionesCampanaCliente
          campaignId={campana.id}
          revisiones={campana.approvalTokens}
          pendientes={pendientes}
        />
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/client-dashboard"
            className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a mis campañas
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{campana.name}</h1>
          {campana.description && (
            <p className="mt-1 text-sm text-gray-500">{campana.description}</p>
          )}
        </div>
        <Badge className={CAMPAIGN_STATUS_COLORS[campana.status]}>
          {CAMPAIGN_STATUS_LABELS[campana.status] ?? campana.status}
        </Badge>
      </div>

      <CampaignTabs pestanas={pestanas} />
    </>
  );
}

export default function ResultadosCampanaCliente({ params }: PageProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Suspense
        fallback={
          <div className="py-20 text-center text-sm text-gray-500">
            Cargando campaña…
          </div>
        }
      >
        <Contenido params={params} />
      </Suspense>
    </div>
  );
}
