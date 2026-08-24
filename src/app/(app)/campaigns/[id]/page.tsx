import { auth } from "@/lib/auth";
import { getCampaignDetail } from "@/data-access/campaigns";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pencil,
  Building2,
  User,
  Calendar,
  DollarSign,
  Eye,
  Instagram,
} from "lucide-react";
import { formatNumber, formatCompactNumber, calculateReach, getReachPercentage } from "@/lib/format";
import { getCachedReachRanges } from "@/lib/cache";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_COLORS,
  PROFILE_STATUS_LABELS,
  PROFILE_STATUS_COLORS,
  calculateMarkupPrice,
  calcularTotalCampana,
} from "@/lib/campaign-utils";
import { CampaignStatusActions } from "@/components/campaigns/campaign-status-actions";
import { ApprovalTokensCard } from "@/components/campaigns/approval-tokens-card";
import { exigePropiedadParaEscribir, type Rol } from "@/lib/permissions";
import { EditarMargen } from "@/components/campaigns/editar-margen";
import { EntregasCampana } from "@/components/campaigns/entregas-campana";
import { ReemplazarInfluencer } from "@/components/campaigns/reemplazar-influencer";
import { MetricasCampana } from "@/components/campaigns/metricas-campana";
import { historicoDeCampana } from "@/data-access/metricas";
import { getAllProfilesForEditor } from "@/data-access/profiles";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignDetailPage({ params }: PageProps) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user) {
    redirect("/login");
  }

  let campaign;
  try {
    campaign = await getCampaignDetail(id);
  } catch {
    notFound();
  }

  // El alcance lo decide la tabla de permisos, no el rol: hoy las
  // campanas son de todo el equipo, pero si manana se restringen basta
  // con cambiar la tabla y esta comprobacion sigue valiendo.
  const esAdmin = session.user.role === "ADMIN";

  if (
    exigePropiedadParaEscribir(session.user.role as Rol, "campanas") &&
    campaign.createdById !== session.user.id
  ) {
    redirect("/campaigns");
  }

  const reachRanges = await getCachedReachRanges();

  // El importe lo calcula calcularTotalCampana, que es la unica que sabe
  // que los retirados no suman. Este bucle solo reune alcance, formatos y
  // demografia.
  const totales = calcularTotalCampana(campaign.profiles, campaign.markupPercentage);
  const totalCampaign = totales.conMargen;
  let totalReach = 0;
  const accountsProcessed = new Set<string>();
  const formatCounts = new Map<string, number>();
  const genderCounts = new Map<string, number>();
  const departmentCounts = new Map<string, number>();

  campaign.profiles.forEach((cp) => {
    // Un retirado ya no aporta alcance ni cuenta en la demografia: sigue
    // listado mas abajo, pero fuera de las cifras de la campana.
    if (cp.participacion !== "ACTIVO") return;

    // Contar géneros y departamentos
    if (cp.profile.gender) {
      const g = cp.profile.gender.displayName;
      genderCounts.set(g, (genderCounts.get(g) || 0) + 1);
    }
    if (cp.profile.department) {
      const d = cp.profile.department.name;
      departmentCounts.set(d, (departmentCounts.get(d) || 0) + 1);
    }

    cp.platforms.forEach((cpp) => {
      cpp.services.forEach((cs) => {
        // Contar formatos
        const fname = cs.esCombo
          ? "Combo"
          : cs.profileService!.serviceType.displayName;
        formatCounts.set(fname, (formatCounts.get(fname) || 0) + cs.quantity);
      });

      // Sumar alcance por cuenta (una vez por cuenta)
      if (!accountsProcessed.has(cpp.socialAccountId)) {
        accountsProcessed.add(cpp.socialAccountId);
        const followers = cpp.socialAccount.followers || 0;
        const reach = calculateReach(followers, reachRanges);
        if (reach) totalReach += reach;
      }
    });
  });
  const budget = Number(campaign.budget);
  const isOverBudget = totalCampaign > budget;

  // Contar estados de perfiles
  // Historico de metricas para las graficas. Se aplana aqui: el
  // componente solo necesita saber de que influencer y plataforma es
  // cada captura, no toda la cadena de relaciones.
  const capturas = (await historicoDeCampana(id)).map((m) => {
    const cpp = m.entrega.campaignService.campaignProfilePlatform;
    return {
      capturadoEn: m.capturadoEn.toISOString(),
      vistas: m.vistas,
      meGusta: m.meGusta,
      comentarios: m.comentarios,
      compartidos: m.compartidos,
      guardados: m.guardados,
      entregaId: m.entrega.id,
      influencer: cpp.campaignProfile.profile.name,
      plataforma: cpp.socialAccount.platform.displayName,
      username: cpp.socialAccount.username,
    };
  });

  // Datos del bloque de entregas. Se aplana aqui, en el servidor, para
  // que el componente cliente reciba justo lo que pinta y las fechas
  // viajen ya como texto.
  const perfilesEntregas = campaign.profiles.map((cp) => ({
    id: cp.id,
    nombre: cp.profile.name,
    participacion: cp.participacion,
    origenRetiro: cp.origenRetiro,
    motivoRetiro: cp.motivoRetiro,
    retiradoEn: cp.retiradoEn?.toISOString() ?? null,
    plataformas: cp.platforms.map((cpp) => ({
      id: cpp.id,
      plataforma: cpp.socialAccount.platform.displayName,
      username: cpp.socialAccount.username,
      formatos: cpp.services.map((cs) => ({
        id: cs.id,
        quantity: cs.quantity,
        esCombo: cs.esCombo,
        comboDescripcion: cs.comboDescripcion,
        fechaLimite: cs.fechaLimite?.toISOString() ?? null,
        // Un combo agrupa formatos con enlace, asi que nunca es efimero.
        esEfimero: cs.esCombo
          ? false
          : cs.profileService?.serviceType.esEfimero ?? false,
        nombre: cs.esCombo
          ? "Combo"
          : cs.profileService?.serviceType.displayName ?? "Formato",
        entregas: cs.entregas.map((e) => ({
          id: e.id,
          url: e.url,
          entregadoEn: e.entregadoEn.toISOString(),
          publicadoEn: e.publicadoEn?.toISOString() ?? null,
          notas: e.notas,
          registradoPor: e.registradoPor,
          metricas: e.metricas.map((m) => ({
            ...m,
            capturadoEn: m.capturadoEn.toISOString(),
          })),
        })),
      })),
    })),
  }));

  // Influencers anadidos a la campana en marcha que esperan decision.
  const pendientesDeAprobacion = campaign.profiles
    .filter((cp) => cp.participacion === "ACTIVO" && cp.status === "PENDING")
    .map((cp) => ({ campaignProfileId: cp.id, nombre: cp.profile.name }));

  const idsEnCampana = new Set(campaign.profiles.map((cp) => cp.profile.id));

  // El catalogo para sustituir. Solo se carga con la campana en marcha:
  // en el resto de estados el bloque no se pinta y seria traer para nada
  // todos los perfiles con sus cuentas y tarifas.
  const catalogoParaSustituir =
    campaign.status === "ACTIVE"
      ? (await getAllProfilesForEditor()).filter((p) => !idsEnCampana.has(p.id))
      : [];

  const activos = campaign.profiles.filter((p) => p.participacion === "ACTIVO");
  const profileCounts = {
    total: activos.length,
    approved: activos.filter((p) => p.status === "APPROVED").length,
    rejected: activos.filter((p) => p.status === "REJECTED").length,
    pending: activos.filter((p) => p.status === "PENDING").length,
  };

  const getPlatformIcon = (platformName: string) => {
    switch (platformName.toLowerCase()) {
      case "instagram":
        return <Instagram className="h-4 w-4" />;
      case "tiktok":
        return (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
          <p className="text-gray-500 mt-1">{campaign.client.companyName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={CAMPAIGN_STATUS_COLORS[campaign.status]}>
            {CAMPAIGN_STATUS_LABELS[campaign.status] || campaign.status}
          </Badge>
          {(campaign.status === "DRAFT" || campaign.status === "PENDING") && (
            <Link href={`/campaigns/${id}/edit`}>
              <Button variant="outline">
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Acciones de estado */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones</CardTitle>
        </CardHeader>
        <CardContent>
          <CampaignStatusActions
            campaignId={id}
            currentStatus={campaign.status}
            profilesCount={profileCounts.total}
            approvedCount={profileCounts.approved}
            rejectedCount={profileCounts.rejected}
            pendingCount={profileCounts.pending}
          />
        </CardContent>
      </Card>

      {/* Tokens de aprobación - mostrar si hay tokens o si está en REVIEW */}
      {(campaign.approvalTokens.length > 0 || campaign.status === "REVIEW") && (
        <ApprovalTokensCard
          campaignId={id}
          tokens={campaign.approvalTokens}
          campaignStatus={campaign.status}
        />
      )}

      {/* Entregas: solo tiene sentido cuando la campana ya esta en marcha.
          En borrador o revision los formatos aun pueden cambiar. */}
      {campaign.status !== "DRAFT" && campaign.status !== "REVIEW" && (
        <EntregasCampana
          campaignId={id}
          perfiles={perfilesEntregas}
          puedeEditar={campaign.status === "ACTIVE" || campaign.status === "PENDING"}
        />
      )}

      {/* Sustituciones: solo con la campana en marcha. Antes de activarla
          los cambios se hacen en el editor, que permite mucho mas. */}
      {campaign.status === "ACTIVE" && (
        <ReemplazarInfluencer
          campaignId={id}
          profiles={catalogoParaSustituir}
          presupuestoLiberado={totales.liberado}
          totalActual={totalCampaign}
          presupuesto={budget}
          pendientes={pendientesDeAprobacion}
          markup={campaign.markupPercentage}
        />
      )}

      {/* Impacto: solo cuando ya hay contenido publicado que medir. */}
      {campaign.status !== "DRAFT" && campaign.status !== "REVIEW" && (
        <MetricasCampana
          campaignId={id}
          capturas={capturas}
          puedeRefrescar={campaign.status === "ACTIVE" || campaign.status === "COMPLETED"}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Información principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Descripción */}
          {campaign.description && (
            <Card>
              <CardHeader>
                <CardTitle>Descripción</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">{campaign.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Perfiles y Formatos */}
          <Card>
            <CardHeader>
              <CardTitle>
                Perfiles y Formatos
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({campaign.profiles.length} perfil
                  {campaign.profiles.length !== 1 ? "es" : ""})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {campaign.profiles.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No hay perfiles asignados a esta campaña.
                </p>
              ) : (
                <div className="space-y-6">
                  {campaign.profiles.map((cp) => (
                    <div key={cp.id} className={`border rounded-lg p-4 ${
                      cp.status === "REJECTED" ? "border-red-300 bg-red-50" :
                      cp.status === "APPROVED" ? "border-green-300 bg-green-50" : ""
                    }`}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div>
                            <h3 className="font-medium">{cp.profile.name}</h3>
                            <Badge variant="secondary" className="mt-1">
                              {cp.profile.type === "INFLUENCER"
                                ? "Influencer"
                                : cp.profile.type === "UGC"
                                ? "UGC"
                                : "Ambos"}
                            </Badge>
                          </div>
                        </div>
                        {/* Estado del perfil en la campaña */}
                        {(campaign.status === "REVIEW" || campaign.status === "PENDING" || campaign.status === "ACTIVE") && (
                          <Badge className={PROFILE_STATUS_COLORS[cp.status]}>
                            {PROFILE_STATUS_LABELS[cp.status]}
                          </Badge>
                        )}
                      </div>

                      {/* Motivo de rechazo */}
                      {cp.status === "REJECTED" && cp.rejectionReason && (
                        <div className="mb-4 p-3 bg-red-100 rounded-lg">
                          <p className="text-sm text-red-800">
                            <strong>Motivo de rechazo:</strong> {cp.rejectionReason}
                          </p>
                        </div>
                      )}

                      {cp.platforms.map((cpp) => {
                        const followers = cpp.socialAccount.followers || 0;
                        const reach = calculateReach(followers, reachRanges);
                        const reachPercent = getReachPercentage(followers, reachRanges);

                        return (
                          <div key={cpp.id} className="ml-4 mb-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {getPlatformIcon(cpp.socialAccount.platform.name)}
                                <span className="font-medium">
                                  {cpp.socialAccount.platform.displayName}
                                </span>
                                <Badge variant="outline">
                                  @{cpp.socialAccount.username}
                                </Badge>
                              </div>
                              {followers > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  <span>{followers.toLocaleString()} seguidores</span>
                                  <span className="mx-2">|</span>
                                  <span className="text-green-600">
                                    {reach?.toLocaleString()} alcance ({reachPercent}%)
                                  </span>
                                </div>
                              )}
                            </div>

                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Formato</TableHead>
                                  <TableHead className="text-center">
                                    Cantidad
                                  </TableHead>
                                  <TableHead className="text-right">
                                    Precio
                                  </TableHead>
                                  <TableHead className="text-right">
                                    Subtotal
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {cpp.services.map((cs) => {
                                  const basePrice = Number(cs.basePrice);
                                  const price = calculateMarkupPrice(
                                    basePrice,
                                    campaign.markupPercentage
                                  );
                                  const subtotal = price * cs.quantity;

                                  return (
                                    <TableRow key={cs.id}>
                                      <TableCell>
                                        {cs.esCombo ? (
                                          <>
                                            Combo
                                            {cs.comboDescripcion && (
                                              <span className="ml-1 text-xs text-gray-500">
                                                ({cs.comboDescripcion})
                                              </span>
                                            )}
                                          </>
                                        ) : (
                                          cs.profileService!.serviceType.displayName
                                        )}
                                        {cs.clientNotes && (
                                          <p className="text-xs text-muted-foreground mt-1 italic">
                                            Tema: &ldquo;{cs.clientNotes}&rdquo;
                                          </p>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {cs.quantity}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        ${formatNumber(price.toFixed(0))}
                                      </TableCell>
                                      <TableCell className="text-right font-medium">
                                        ${formatNumber(subtotal.toFixed(0))}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Resumen */}
          <Card className={isOverBudget ? "border-red-300" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Resumen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-500">Presupuesto:</span>
                <span className="font-bold">
                  ${formatNumber(budget.toString())}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-gray-500">
                  Margen:
                  {esAdmin && (
                    <EditarMargen
                      campaignId={campaign.id}
                      markupActual={campaign.markupPercentage}
                      yaEnviadaAlCliente={campaign.status !== "DRAFT"}
                    />
                  )}
                </span>
                <span className="font-medium">
                  {Math.round(campaign.markupPercentage * 1000) / 10}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total:</span>
                <span
                  className={`font-bold ${
                    isOverBudget ? "text-red-600" : "text-green-600"
                  }`}
                >
                  ${formatNumber(totalCampaign.toFixed(0))}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-gray-500">
                  {isOverBudget ? "Excedente:" : "Disponible:"}
                </span>
                <span
                  className={`font-bold ${
                    isOverBudget ? "text-red-600" : "text-blue-600"
                  }`}
                >
                  ${formatNumber(Math.abs(budget - totalCampaign).toFixed(0))}
                </span>
              </div>
              {totalReach > 0 && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 flex items-center gap-1.5">
                      <Eye className="h-4 w-4 text-green-600" />
                      Alcance Estimado:
                    </span>
                    <span className="font-bold text-green-600">
                      {formatCompactNumber(totalReach)}{" "}
                      <span className="text-sm font-normal text-gray-500">({totalReach.toLocaleString()})</span>
                    </span>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Perfiles:</span>
                <span className="font-medium">{campaign.profiles.length}</span>
              </div>

              {/* Formatos */}
              {formatCounts.size > 0 && (
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Formatos:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[...formatCounts.entries()].map(([name, count]) => (
                      <Badge key={name} variant="secondary" className="text-xs">
                        {name} ({count})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Géneros */}
              {genderCounts.size > 0 && (
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Géneros:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[...genderCounts.entries()].map(([name, count]) => (
                      <Badge key={name} variant="outline" className="text-xs">
                        {name} ({count})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Departamentos */}
              {departmentCounts.size > 0 && (
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Departamentos:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[...departmentCounts.entries()].map(([name, count]) => (
                      <Badge key={name} variant="outline" className="text-xs">
                        {name} ({count})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium">{campaign.client.companyName}</p>
              <p className="text-sm text-gray-500">{campaign.client.email}</p>
            </CardContent>
          </Card>

          {/* Contacto */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Contacto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-medium">
                {campaign.clientContact.firstName}{" "}
                {campaign.clientContact.lastName}
              </p>
              {campaign.clientContact.position && (
                <p className="text-sm text-gray-500">
                  {campaign.clientContact.position}
                </p>
              )}
              <p className="text-sm text-gray-500">
                {campaign.clientContact.email}
              </p>
              {campaign.clientContact.phone && (
                <p className="text-sm text-gray-500">
                  {campaign.clientContact.phone}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Fechas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Fechas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Inicio:</span>
                <span>
                  {campaign.startDate
                    ? new Date(campaign.startDate).toLocaleDateString("es-CO")
                    : "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Fin:</span>
                <span>
                  {campaign.endDate
                    ? new Date(campaign.endDate).toLocaleDateString("es-CO")
                    : "-"}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Creado:</span>
                <span>
                  {new Date(campaign.createdAt).toLocaleDateString("es-CO")}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Por:</span>
                <span>{campaign.createdBy.name}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
