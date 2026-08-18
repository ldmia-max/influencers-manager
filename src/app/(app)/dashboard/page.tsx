import { auth } from "@/lib/auth";
import { getProfileCount } from "@/data-access/profiles";
import { getDashboardCampaigns } from "@/data-access/campaigns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Users, FolderOpen } from "lucide-react";
import { formatNumber } from "@/lib/format";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_VARIANTS,
} from "@/lib/campaign-utils";
import { exigePropiedadParaLeer, type Rol } from "@/lib/permissions";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user.id;
  const rol = (session?.user.role ?? "USER") as Rol;
  const verTodasCampanas = !exigePropiedadParaLeer(rol, "campanas");
  const verTodosPerfiles = !exigePropiedadParaLeer(rol, "perfiles");

  const [profileCount, { activeCampaigns, draftCampaigns }] = await Promise.all([
    getProfileCount(verTodosPerfiles ? undefined : { createdById: userId }),
    getDashboardCampaigns(userId!, verTodasCampanas),
  ]);

  const totalCampaigns = activeCampaigns.length + draftCampaigns.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido, {session?.user.name}
        </h1>
        <div className="flex gap-2">
          <Link href="/profiles/new">
            <Button variant="outline">Nuevo Perfil</Button>
          </Link>
          <Link href="/campaigns/new">
            <Button>Nueva Campaña</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Perfiles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{profileCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Megaphone className="h-4 w-4" />
              Campañas Activas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activeCampaigns.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Borradores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{draftCampaigns.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Campañas Activas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Campañas Activas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeCampaigns.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No hay campañas activas.
            </p>
          ) : (
            <div className="space-y-3">
              {activeCampaigns.map((campaign) => (
                <Link
                  key={campaign.id}
                  href={`/campaigns/${campaign.id}`}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">
                      {campaign.name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {campaign.client.companyName} · ${formatNumber(Number(campaign.budget).toFixed(0))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      {campaign._count.profiles} perfil{campaign._count.profiles !== 1 ? "es" : ""}
                    </Badge>
                    <Badge variant={CAMPAIGN_STATUS_VARIANTS[campaign.status]}>
                      {CAMPAIGN_STATUS_LABELS[campaign.status]}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Borradores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Borradores
          </CardTitle>
        </CardHeader>
        <CardContent>
          {draftCampaigns.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No hay borradores.{" "}
              <Link href="/campaigns/new" className="text-blue-600 hover:underline">
                Crea tu primera campaña
              </Link>
            </p>
          ) : (
            <div className="space-y-3">
              {draftCampaigns.map((campaign) => (
                <Link
                  key={campaign.id}
                  href={`/campaigns/${campaign.id}`}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">
                      {campaign.name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {campaign.client.companyName} · ${formatNumber(Number(campaign.budget).toFixed(0))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      {campaign._count.profiles} perfil{campaign._count.profiles !== 1 ? "es" : ""}
                    </Badge>
                    <Badge variant={CAMPAIGN_STATUS_VARIANTS[campaign.status]}>
                      {CAMPAIGN_STATUS_LABELS[campaign.status]}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link a ver todas */}
      {totalCampaigns > 0 && (
        <div className="text-center">
          <Link href="/campaigns">
            <Button variant="outline">Ver todas las campañas</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
