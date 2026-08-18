"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Instagram, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { formatNumber, calculateReach, getReachPercentage } from "@/lib/format";
import { useReachRanges } from "@/hooks/queries/use-reach-ranges";
import { calculateMarkupPrice, calculateServiceTotal } from "@/lib/campaign-utils";
import { useCampaignWizardStore } from "@/stores/campaign-wizard-store";
import type {
  ProfileWithServices,
  ProfileConfig,
} from "@/models/campaign";

// Re-export types for backwards compatibility
export type { ServiceConfig, PlatformConfig, ProfileConfig } from "@/models/campaign";

interface PlatformServiceSelectorProps {
  profiles: ProfileWithServices[];
  selectedProfileIds: string[];
  config: ProfileConfig[];
  onChange: (config: ProfileConfig[]) => void;
  onRemoveProfile: (profileId: string) => void;
}

export function PlatformServiceSelector({
  profiles,
  selectedProfileIds,
  config,
  onChange,
  onRemoveProfile,
}: PlatformServiceSelectorProps) {
  const { data: reachRanges = [] } = useReachRanges();
  // Margen de la campana que se esta editando (o el global si es nueva).
  const markup = useCampaignWizardStore((st) => st.markup);
  const [expandedProfiles, setExpandedProfiles] = useState<string[]>([]);

  // Inicializar configuración cuando cambian los perfiles seleccionados
  useEffect(() => {
    const newConfig: ProfileConfig[] = selectedProfileIds.map((profileId) => {
      const profile = profiles.find((p) => p.id === profileId);
      const existingConfig = config.find((c) => c.profileId === profileId);

      // Construir la configuración completa desde el perfil
      const fullConfig: ProfileConfig = {
        profileId,
        profileName: profile?.name || "",
        platforms:
          profile?.socialAccounts.map((sa) => {
            // Buscar si hay configuración existente para esta plataforma
            const existingPlatform = existingConfig?.platforms.find(
              (p) => p.socialAccountId === sa.id
            );

            return {
              socialAccountId: sa.id,
              platformId: sa.platform.id,
              platformName: sa.platform.displayName,
              username: sa.username,
              selected: existingPlatform?.selected ?? false,
              services: sa.services.map((s) => {
                // Buscar si hay configuración existente para este servicio
                const existingService = existingPlatform?.services.find(
                  (es) => es.profileServiceId === s.id
                );

                return {
                  profileServiceId: s.id,
                  serviceTypeId: s.serviceType.id,
                  serviceName: s.serviceType.displayName,
                  quantity: existingService?.quantity ?? 0,
                  basePrice: Number(s.price),
                };
              }),
            };
          }) || [],
      };

      return fullConfig;
    });

    // Solo actualizar si hay cambios reales
    const hasChanges =
      newConfig.length !== config.length ||
      newConfig.some((nc) => {
        const existing = config.find((c) => c.profileId === nc.profileId);
        if (!existing) return true;
        // Verificar si falta información (platformName vacío indica datos incompletos)
        return existing.platforms.some((p) => !p.platformName || !p.platformId);
      });

    if (hasChanges) {
      onChange(newConfig);
      // Expandir perfiles que tienen servicios seleccionados
      const profilesWithServices = newConfig
        .filter((pc) => pc.platforms.some((p) => p.selected))
        .map((pc) => pc.profileId);

      setExpandedProfiles((prev) => [
        ...new Set([...prev, ...profilesWithServices]),
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- adding config/onChange would cause infinite loop
  }, [selectedProfileIds, profiles]);

  const toggleProfileExpand = (profileId: string) => {
    setExpandedProfiles((prev) =>
      prev.includes(profileId)
        ? prev.filter((id) => id !== profileId)
        : [...prev, profileId]
    );
  };

  const togglePlatform = (profileId: string, socialAccountId: string) => {
    onChange(
      config.map((pc) => {
        if (pc.profileId !== profileId) return pc;
        return {
          ...pc,
          platforms: pc.platforms.map((plat) => {
            if (plat.socialAccountId !== socialAccountId) return plat;
            const newSelected = !plat.selected;
            return {
              ...plat,
              selected: newSelected,
              services: plat.services.map((s) => ({
                ...s,
                quantity: newSelected ? (s.quantity || 1) : 0,
              })),
            };
          }),
        };
      })
    );
  };

  const toggleService = (
    profileId: string,
    socialAccountId: string,
    serviceId: string
  ) => {
    onChange(
      config.map((pc) => {
        if (pc.profileId !== profileId) return pc;
        return {
          ...pc,
          platforms: pc.platforms.map((plat) => {
            if (plat.socialAccountId !== socialAccountId) return plat;
            return {
              ...plat,
              services: plat.services.map((s) => {
                if (s.profileServiceId !== serviceId) return s;
                return {
                  ...s,
                  quantity: s.quantity > 0 ? 0 : 1,
                };
              }),
            };
          }),
        };
      })
    );
  };

  const updateServiceQuantity = (
    profileId: string,
    socialAccountId: string,
    serviceId: string,
    quantity: number
  ) => {
    onChange(
      config.map((pc) => {
        if (pc.profileId !== profileId) return pc;
        return {
          ...pc,
          platforms: pc.platforms.map((plat) => {
            if (plat.socialAccountId !== socialAccountId) return plat;
            return {
              ...plat,
              services: plat.services.map((s) => {
                if (s.profileServiceId !== serviceId) return s;
                return {
                  ...s,
                  quantity: Math.max(0, quantity),
                };
              }),
            };
          }),
        };
      })
    );
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

  const calculateProfileTotal = (profileConfig: ProfileConfig) => {
    let baseTotal = 0;
    let markupTotal = 0;

    profileConfig.platforms.forEach((plat) => {
      if (plat.selected) {
        plat.services.forEach((s) => {
          if (s.quantity > 0) {
            const { baseTotal: sBase, markupTotal: sMarkup } =
              calculateServiceTotal(s.basePrice, s.quantity, markup);
            baseTotal += sBase;
            markupTotal += sMarkup;
          }
        });
      }
    });

    return { baseTotal, markupTotal };
  };

  if (config.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-gray-500 text-center">
            Selecciona perfiles para configurar sus formatos.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {config.map((profileConfig) => {
        const isExpanded = expandedProfiles.includes(profileConfig.profileId);
        const { markupTotal } = calculateProfileTotal(profileConfig);
        const hasSelectedServices = profileConfig.platforms.some(
          (p) => p.selected && p.services.some((s) => s.quantity > 0)
        );

        return (
          <Card key={profileConfig.profileId}>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleProfileExpand(profileConfig.profileId)}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                  <CardTitle className="text-base">
                    {profileConfig.profileName}
                  </CardTitle>
                  {hasSelectedServices && (
                    <Badge variant="default">
                      ${formatNumber(markupTotal.toFixed(0))}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveProfile(profileConfig.profileId)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0 space-y-4">
                {profileConfig.platforms.map((platform) => (
                  <div
                    key={platform.socialAccountId}
                    className="border rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={platform.selected}
                          onCheckedChange={() =>
                            togglePlatform(
                              profileConfig.profileId,
                              platform.socialAccountId
                            )
                          }
                        />
                        <div className="flex items-center gap-2">
                          {getPlatformIcon(platform.platformName)}
                          <span className="font-medium">
                            {platform.platformName}
                          </span>
                          <Badge variant="outline">@{platform.username}</Badge>
                        </div>
                      </div>
                      {/* Mostrar alcance de la cuenta */}
                      {(() => {
                        const profile = profiles.find(p => p.id === profileConfig.profileId);
                        const account = profile?.socialAccounts.find(sa => sa.id === platform.socialAccountId);
                        const followers = account?.followers || 0;
                        const reach = calculateReach(followers, reachRanges);
                        const percentage = getReachPercentage(followers, reachRanges);
                        return followers > 0 ? (
                          <div className="flex items-center gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Seguidores: </span>
                              <span className="font-medium">{followers.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Alcance ({percentage}%): </span>
                              <span className="font-medium text-green-600">{reach?.toLocaleString()}</span>
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>

                    {platform.selected && (
                      <div className="ml-7 space-y-3">
                        <Separator />
                        <div className="grid gap-3">
                          {platform.services.map((service) => {
                            const markupPrice = calculateMarkupPrice(
                              service.basePrice,
                              markup
                            );
                            const { markupTotal: sMarkup } =
                              calculateServiceTotal(
                                service.basePrice,
                                service.quantity,
                                markup
                              );

                            return (
                              <div
                                key={service.profileServiceId}
                                className="grid grid-cols-12 gap-3 items-center py-2 border-b last:border-0"
                              >
                                <div className="col-span-5 flex items-center gap-2">
                                  <Checkbox
                                    checked={service.quantity > 0}
                                    onCheckedChange={() =>
                                      toggleService(
                                        profileConfig.profileId,
                                        platform.socialAccountId,
                                        service.profileServiceId
                                      )
                                    }
                                  />
                                  <Label className="text-sm">
                                    {service.serviceName}
                                  </Label>
                                </div>
                                <div className="col-span-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={service.quantity}
                                    onChange={(e) =>
                                      updateServiceQuantity(
                                        profileConfig.profileId,
                                        platform.socialAccountId,
                                        service.profileServiceId,
                                        parseInt(e.target.value, 10) || 0
                                      )
                                    }
                                    className="w-20"
                                    disabled={service.quantity === 0}
                                  />
                                </div>
                                <div className="col-span-2 text-sm font-medium">
                                  ${formatNumber(markupPrice.toFixed(0))}
                                </div>
                                <div className="col-span-3 text-sm font-medium text-right">
                                  {service.quantity > 0 && (
                                    <span>
                                      ${formatNumber(sMarkup.toFixed(0))}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="grid grid-cols-12 gap-3 text-xs text-gray-500 pt-2">
                          <span className="col-span-5">Formato</span>
                          <span className="col-span-2">Cant.</span>
                          <span className="col-span-2">Precio</span>
                          <span className="col-span-3 text-right">Subtotal</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {hasSelectedServices && (
                  <div className="flex justify-end pt-2 border-t">
                    <div className="text-sm font-semibold">
                      Total: ${formatNumber(markupTotal.toFixed(0))}
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
