import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Users } from "lucide-react";
import {
  COOKIE_SESION_CLIENTE,
  verificarSesionCliente,
} from "@/lib/client-session";
import { getCampaignResultsForClient } from "@/data-access/campaigns";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_COLORS,
} from "@/lib/campaign-utils";
import { formatCompactNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricasCampana } from "@/components/campaigns/metricas-campana";

interface PageProps {
  params: Promise<{ campaignId: string }>;
}

/**
 * Resultados de una campana en el portal del cliente.
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
            vistas: m.vistas,
            meGusta: m.meGusta,
            comentarios: m.comentarios,
            compartidos: m.compartidos,
            guardados: m.guardados,
            entregaId: e.id,
            influencer: cp.profile.name,
            plataforma: cpp.socialAccount.platform.displayName,
            username: cpp.socialAccount.username,
          }))
        )
      )
    )
  );

  const totalSeguidores = campana.profiles.reduce(
    (suma, cp) =>
      suma +
      cp.platforms.reduce((s, p) => s + (p.socialAccount.followers ?? 0), 0),
    0
  );

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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-gray-500">Creadores</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {campana.profiles.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-gray-500">Audiencia sumada</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {formatCompactNumber(totalSeguidores)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* El cliente mira, no refresca: cada lectura consume crédito. */}
      <MetricasCampana campaignId={campana.id} capturas={capturas} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Contenido publicado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {campana.profiles.map((cp) => (
            <div key={cp.id} className="rounded-xl border border-gray-200 p-4">
              <p className="font-medium text-gray-900">{cp.profile.name}</p>

              {cp.platforms.map((cpp, i) => (
                <div key={i} className="mt-2 space-y-2">
                  <p className="text-xs text-gray-500">
                    @{cpp.socialAccount.username} ·{" "}
                    {cpp.socialAccount.platform.displayName}
                    {cpp.socialAccount.followers != null &&
                      ` · ${formatCompactNumber(cpp.socialAccount.followers)} seguidores`}
                  </p>

                  {cpp.services.map((cs) => (
                    <div key={cs.id} className="rounded-lg bg-gray-50 p-3">
                      <p className="text-sm font-medium text-gray-800">
                        {cs.esCombo
                          ? cs.comboDescripcion || "Combo"
                          : cs.profileService?.serviceType.displayName}
                      </p>

                      {cs.entregas.length === 0 ? (
                        <p className="mt-1 text-xs text-gray-500">
                          Pendiente de publicación
                        </p>
                      ) : (
                        <ul className="mt-1 space-y-1">
                          {cs.entregas.map((e) => (
                            <li key={e.id}>
                              <a
                                href={e.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Ver publicación
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}

          {campana.profiles.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-500">
              Todavía no hay creadores confirmados en esta campaña.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default function ResultadosCampanaCliente({ params }: PageProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <Suspense
          fallback={
            <div className="py-20 text-center text-sm text-gray-500">
              Cargando resultados…
            </div>
          }
        >
          <Contenido params={params} />
        </Suspense>
      </div>
    </div>
  );
}
