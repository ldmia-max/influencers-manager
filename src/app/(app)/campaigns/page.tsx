import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Eye, Megaphone } from "lucide-react";
import { DeleteCampaignMenuItem } from "@/components/campaigns/delete-campaign-dialog";
import { formatNumber, formatCompactNumber, calculateReach } from "@/lib/format";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_VARIANTS,
} from "@/lib/campaign-utils";
import { getCachedReachRanges } from "@/lib/cache";
import { CampaignStatus } from "@prisma/client";
import { exigePropiedadParaLeer, type Rol } from "@/lib/permissions";

interface SearchParams {
  search?: string;
  clientId?: string;
  status?: string;
  page?: string;
  pageSize?: string;
}

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const params = await searchParams;

  const page = params.page ? parseInt(params.page) : 1;
  const pageSize = params.pageSize ? parseInt(params.pageSize) : 10;
  const skip = (page - 1) * pageSize;
  // El alcance lo decide la tabla de permisos, no el rol.
  const verTodas = !exigePropiedadParaLeer(
    (session?.user.role ?? "USER") as Rol,
    "campanas"
  );

  const where = {
    AND: [
      verTodas ? {} : { createdById: session?.user.id },
      // Filtro por búsqueda
      params.search
        ? {
            OR: [
              {
                name: { contains: params.search, mode: "insensitive" as const },
              },
              {
                client: {
                  companyName: {
                    contains: params.search,
                    mode: "insensitive" as const,
                  },
                },
              },
            ],
          }
        : {},
      // Filtro por cliente
      params.clientId ? { clientId: params.clientId } : {},
      // Filtro por status
      params.status ? { status: params.status as CampaignStatus } : {},
    ],
  };

  const [campaigns, total, reachRanges] = await Promise.all([
    prisma.campaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        client: {
          select: {
            id: true,
            companyName: true,
          },
        },
        clientContact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        profiles: {
          include: {
            platforms: {
              include: {
                socialAccount: {
                  select: { followers: true },
                },
                services: true,
              },
            },
          },
        },
      },
    }),
    prisma.campaign.count({ where }),
    getCachedReachRanges(),
  ]);

  // Convertir reach ranges a formato esperado
  const reachRangeData = reachRanges.map((r) => ({
    minFollowers: r.minFollowers,
    maxFollowers: r.maxFollowers,
    reachPercentage: Number(r.reachPercentage),
  }));

  // Calcular totales para cada campaña
  const campaignsWithTotals = campaigns.map((campaign) => {
    let totalBase = 0;
    let totalReach = 0;
    const accountsProcessed = new Set<string>();

    campaign.profiles.forEach((cp) => {
      cp.platforms.forEach((cpp) => {
        cpp.services.forEach((cs) => {
          totalBase += Number(cs.basePrice) * cs.quantity;
        });

        // Sumar alcance por cuenta (una vez por cuenta)
        if (!accountsProcessed.has(cpp.socialAccountId)) {
          accountsProcessed.add(cpp.socialAccountId);
          const followers = cpp.socialAccount?.followers ?? null;
          const reach = calculateReach(followers, reachRangeData);
          if (reach) totalReach += reach;
        }
      });
    });

    const totalWithMarkup = totalBase * 1.2;

    return {
      ...campaign,
      totalBase,
      totalWithMarkup,
      totalReach,
      profileCount: campaign.profiles.length,
    };
  });

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Campañas</h1>
        <Link href="/campaigns/new">
          <Button>Nueva Campaña</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Lista de Campañas
            {total > 0 && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({total} campaña{total !== 1 ? "s" : ""})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {campaignsWithTotals.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No hay campañas creadas aún.{" "}
              <Link
                href="/campaigns/new"
                className="text-blue-600 hover:underline"
              >
                Crea tu primera campaña
              </Link>
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Presupuesto</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Alcance</TableHead>
                    <TableHead>Perfiles</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignsWithTotals.map((campaign) => {
                    const budgetNum = Number(campaign.budget);
                    const isOverBudget = campaign.totalWithMarkup > budgetNum;

                    return (
                      <TableRow key={campaign.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Megaphone className="h-4 w-4 text-gray-400" />
                            {campaign.name}
                          </div>
                        </TableCell>
                        <TableCell>{campaign.client.companyName}</TableCell>
                        <TableCell>
                          {campaign.clientContact.firstName}{" "}
                          {campaign.clientContact.lastName}
                        </TableCell>
                        <TableCell>
                          ${formatNumber(budgetNum.toString())}
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              isOverBudget ? "text-red-600 font-medium" : ""
                            }
                          >
                            ${formatNumber(campaign.totalWithMarkup.toFixed(0))}
                          </span>
                        </TableCell>
                        <TableCell>
                          {campaign.totalReach > 0 ? (
                            <span className="text-green-600 font-medium" title={campaign.totalReach.toLocaleString()}>
                              {formatCompactNumber(campaign.totalReach)}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {campaign.profileCount} perfil
                            {campaign.profileCount !== 1 ? "es" : ""}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              CAMPAIGN_STATUS_VARIANTS[campaign.status] ||
                              "secondary"
                            }
                          >
                            {CAMPAIGN_STATUS_LABELS[campaign.status] ||
                              campaign.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                aria-label="Acciones"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/campaigns/${campaign.id}`}
                                  className="flex items-center gap-2"
                                >
                                  <Eye className="h-4 w-4" />
                                  Ver Detalle
                                </Link>
                              </DropdownMenuItem>
                              {campaign.status === "DRAFT" && (
                                <>
                                  <DropdownMenuItem asChild>
                                    <Link
                                      href={`/campaigns/${campaign.id}/edit`}
                                      className="flex items-center gap-2"
                                    >
                                      <Pencil className="h-4 w-4" />
                                      Editar
                                    </Link>
                                  </DropdownMenuItem>
                                  <DeleteCampaignMenuItem
                                    campaignId={campaign.id}
                                    campaignName={campaign.name}
                                  />
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {campaignsWithTotals.length > 0 && (
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  total={total}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
