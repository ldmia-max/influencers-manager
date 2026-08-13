"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useProfile } from "@/hooks/queries/use-profiles";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatNumber, calculateReach, getReachPercentage } from "@/lib/format";
import { useReachRanges } from "@/hooks/queries/use-reach-ranges";
import { Mail, Phone, Pencil } from "lucide-react";
import Link from "next/link";

export function ProfileDetailSheet() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: reachRanges = [] } = useReachRanges();
  const profileId = searchParams.get("view");
  const { data: profile, isLoading: loading } = useProfile(profileId);

  const handleClose = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("view");
    router.push(`?${params.toString()}`);
  };

  return (
    <Sheet open={!!profileId} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="flex items-center justify-between">
            {loading ? (
              <span>Cargando perfil...</span>
            ) : profile ? (
              <>
                <span>{profile.name}</span>
                <Link href={`/profiles/${profile.id}/edit`}>
                  <Button variant="outline" size="sm">
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                </Link>
              </>
            ) : (
              <span>Perfil</span>
            )}
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center h-full py-12">
            <p className="text-gray-500">Cargando...</p>
          </div>
        ) : profile ? (
          <>

            <div className="px-6 py-6 pb-8 space-y-6">
              {/* Info básica */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      profile.type === "INFLUENCER"
                        ? "default"
                        : profile.type === "UGC"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {profile.type === "BOTH"
                      ? "Ambos (Influencer + UGC)"
                      : profile.type}
                  </Badge>
                  {profile.createdBy && (
                    <span className="text-sm text-gray-500">
                      Creado por {profile.createdBy.name}
                    </span>
                  )}
                </div>

                {(profile.country || profile.city) && (
                  <div className="text-sm text-gray-600">
                    {[profile.city?.name, profile.department?.name, profile.country?.name]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                )}

                {/* Contacto */}
                {(profile.email || profile.phone) && (
                  <div className="flex flex-wrap gap-4 pt-1">
                    {profile.email && (
                      <a
                        href={`mailto:${profile.email}`}
                        className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {profile.email}
                      </a>
                    )}
                    {profile.phone && (
                      <a
                        href={`tel:${profile.phone}`}
                        className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {profile.phone}
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Categorías */}
              {profile.categories.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    Categorías
                  </h3>
                  <div className="flex gap-2 flex-wrap">
                    {profile.categories.map((pc) => (
                      <Badge key={pc.category.id} variant="outline">
                        {pc.category.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Cuentas sociales */}
              <div className="space-y-5">
                <h3 className="text-base font-semibold text-gray-900">
                  Redes Sociales
                </h3>

                <div className="space-y-4">
                  {profile.socialAccounts.map((account) => (
                    <Card key={account.id} className="border shadow-sm">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-3 text-base">
                        <Avatar className="size-10">
                          <AvatarImage
                            src={account.profilePicUrl ?? ""}
                            alt={`Foto de ${account.username}`}
                          />
                          <AvatarFallback>
                            {(account.username?.[0] || "@").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              {account.platform.displayName}
                            </Badge>
                            <span className="font-normal text-sm">
                              @{account.username}
                            </span>
                          </div>
                          {account.fullName && (
                            <p className="text-sm font-normal text-gray-600 mt-1">
                              {account.fullName}
                            </p>
                          )}
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Biografía */}
                      {account.biography && (
                        <p className="text-sm text-gray-600">
                          {account.biography}
                        </p>
                      )}

                      {/* Métricas */}
                      {(account.followers || account.engagementRate) && (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            {account.followers && (
                              <div>
                                <p className="text-xs text-gray-500">
                                  Seguidores
                                </p>
                                <p className="text-sm font-semibold">
                                  {account.followers.toLocaleString()}
                                </p>
                              </div>
                            )}
                            {account.followers && calculateReach(account.followers, reachRanges) && (
                              <div>
                                <p className="text-xs text-gray-500">
                                  Alcance ({getReachPercentage(account.followers, reachRanges)}%)
                                </p>
                                <p className="text-sm font-semibold">
                                  {calculateReach(account.followers, reachRanges)!.toLocaleString()}
                                </p>
                              </div>
                            )}
                            {account.following && (
                              <div>
                                <p className="text-xs text-gray-500">
                                  Siguiendo
                                </p>
                                <p className="text-sm font-semibold">
                                  {account.following.toLocaleString()}
                                </p>
                              </div>
                            )}
                            {account.posts && (
                              <div>
                                <p className="text-xs text-gray-500">Posts</p>
                                <p className="text-sm font-semibold">
                                  {account.posts.toLocaleString()}
                                </p>
                              </div>
                            )}
                            {account.engagementRate && (
                              <div>
                                <p className="text-xs text-gray-500">
                                  Engagement
                                </p>
                                <p className="text-sm font-semibold">
                                  {account.engagementRate.toFixed(2)}%
                                </p>
                              </div>
                            )}
                            {account.avgLikes &&
                              account.platform.displayName === "TikTok" && (
                                <div>
                                  <p className="text-xs text-gray-500">
                                    Me Gusta
                                  </p>
                                  <p className="text-sm font-semibold">
                                    {account.avgLikes.toLocaleString()}
                                  </p>
                                </div>
                              )}
                          </div>
                          <Separator />
                        </>
                      )}

                      {/* Formatos */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-3">
                          Formatos y Precios
                        </h4>
                        <div className="space-y-2">
                          {account.services.map((service) => (
                            <div
                              key={service.id}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm"
                            >
                              <span className="text-gray-700">{service.serviceType.displayName}</span>
                              <span className="font-semibold text-gray-900">
                                ${formatNumber(Number(service.price))}{" "}
                                {service.currency}
                              </span>
                            </div>
                          ))}
                          {account.services.length === 0 && (
                            <p className="text-sm text-gray-500 py-2">
                              No hay formatos con precio definido
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full py-12">
            <p className="text-gray-500">Perfil no encontrado</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
