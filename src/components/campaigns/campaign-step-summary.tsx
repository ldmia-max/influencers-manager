"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Play, Save, Send, Instagram } from "lucide-react";
import { formatNumber, calculateReach, getReachPercentage } from "@/lib/format";
import { calculateMarkupPrice } from "@/lib/campaign-utils";
import { CampaignSummary } from "./campaign-summary";
import type { ProfileWithServices } from "@/models/campaign";
import { useCampaignWizard } from "@/contexts/campaign-wizard-context";
import { useCampaignWizardStore } from "@/stores/campaign-wizard-store";
import { useReachRanges } from "@/hooks/queries/use-reach-ranges";

function getPlatformIcon(platformName: string) {
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
}

function getProfileAvatar(profile: ProfileWithServices) {
  const firstAccount = profile.socialAccounts[0];
  return firstAccount?.profilePicUrl || null;
}

export function CampaignStepSummary() {
  const { onSave, onActivateDirectly, profiles, currentStatus } = useCampaignWizard();
  const profileConfigs = useCampaignWizardStore((s) => s.profileConfigs);
  const selectedProfileIds = useCampaignWizardStore((s) => s.selectedProfileIds);
  const loading = useCampaignWizardStore((s) => s.loading);
  const budget = useCampaignWizardStore((s) => s.getBudget());
  const { data: reachRanges = [] } = useReachRanges();
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [activationReason, setActivationReason] = useState("");

  const configuredProfiles = useMemo(
    () =>
      profileConfigs.filter((pc) =>
        pc.platforms.some((p) => p.selected && p.services.some((s) => s.quantity > 0))
      ),
    [profileConfigs]
  );

  const profileTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const config of configuredProfiles) {
      let total = 0;
      for (const p of config.platforms) {
        if (p.selected) {
          for (const s of p.services) {
            if (s.quantity > 0) {
              total += calculateMarkupPrice(s.basePrice) * s.quantity;
            }
          }
        }
      }
      totals.set(config.profileId, total);
    }
    return totals;
  }, [configuredProfiles]);

  const handleActivate = () => {
    onActivateDirectly(activationReason);
    setActivationReason("");
    setShowActivateDialog(false);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Configured profiles */}
        <Card className="lg:col-span-8 flex flex-col max-h-[calc(100vh)] overflow-hidden">
          <CardHeader className="shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Perfiles Configurados</CardTitle>
              <Badge variant="outline">{configuredProfiles.length} perfiles</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            <div className="space-y-4">
              {configuredProfiles.map((config) => {
                const profile = profiles.find((p) => p.id === config.profileId);
                const total = profileTotals.get(config.profileId) || 0;

                return (
                  <div key={config.profileId} className="border rounded-lg overflow-hidden">
                    {/* Profile header */}
                    <div className="flex items-center justify-between p-3 bg-gray-50">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-10">
                          <AvatarImage
                            src={profile ? getProfileAvatar(profile) || "" : ""}
                          />
                          <AvatarFallback>
                            {config.profileName[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{config.profileName}</div>
                          <div className="text-xs text-gray-500">
                            {profile?.gender?.displayName}{" "}
                            {profile?.city && `• ${profile.city.name}`}{" "}
                            {profile?.country && `• ${profile.country.name}`}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">
                          ${formatNumber(total.toFixed(0))}
                        </div>
                        <div className="text-xs text-gray-500">Total</div>
                      </div>
                    </div>

                    {/* Platforms and services */}
                    <div className="p-3 space-y-3">
                      {config.platforms
                        .filter((p) => p.selected && p.services.some((s) => s.quantity > 0))
                        .map((platform) => {
                          const account = profile?.socialAccounts.find(
                            (sa) => sa.id === platform.socialAccountId
                          );
                          const followers = account?.followers || 0;
                          const reach = calculateReach(followers, reachRanges);
                          const reachPercent = getReachPercentage(followers, reachRanges);
                          const platformTotal = platform.services
                            .filter((s) => s.quantity > 0)
                            .reduce(
                              (acc, s) => acc + calculateMarkupPrice(s.basePrice) * s.quantity,
                              0
                            );

                          return (
                            <div
                              key={platform.socialAccountId}
                              className="bg-muted/30 rounded-lg p-2.5"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1.5 text-sm font-medium">
                                    {getPlatformIcon(platform.platformName)}
                                    <span>{platform.platformName}</span>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    @{platform.username}
                                  </span>
                                </div>
                                <div className="text-xs text-right">
                                  <span className="text-muted-foreground">
                                    {followers.toLocaleString()} seg.
                                  </span>
                                  {reach && reach > 0 && (
                                    <span className="text-green-600 ml-2">
                                      {reach.toLocaleString()} alc. ({reachPercent}%)
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-1 ml-5">
                                {platform.services
                                  .filter((s) => s.quantity > 0)
                                  .map((service) => {
                                    const servicePrice = calculateMarkupPrice(service.basePrice);
                                    const serviceTotal = servicePrice * service.quantity;
                                    return (
                                      <div
                                        key={service.profileServiceId}
                                        className="flex items-center justify-between text-xs"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="text-muted-foreground">
                                            {service.quantity}x
                                          </span>
                                          <span>{service.serviceName}</span>
                                        </div>
                                        <span className="text-muted-foreground">
                                          ${formatNumber(servicePrice.toFixed(0))} c/u ={" "}
                                          <span className="text-foreground font-medium">
                                            ${formatNumber(serviceTotal.toFixed(0))}
                                          </span>
                                        </span>
                                      </div>
                                    );
                                  })}
                              </div>

                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 text-xs">
                                <span className="text-muted-foreground">
                                  Subtotal {platform.platformName}
                                </span>
                                <span className="font-medium">
                                  ${formatNumber(platformTotal.toFixed(0))}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Right column: Budget summary and action buttons */}
        <div className="lg:col-span-4 space-y-4">
          <CampaignSummary budget={budget} profileConfigs={profileConfigs} profiles={profiles} reachRanges={reachRanges} />

          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              onClick={() => onSave(false)}
              disabled={loading}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Guardando..." : "Guardar Borrador"}
            </Button>

            {(currentStatus === "DRAFT" || currentStatus === "PENDING") && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={loading || selectedProfileIds.length === 0}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Enviar a Revision
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Enviar a Revision</AlertDialogTitle>
                    <AlertDialogDescription>
                      La campana sera enviada al cliente para su aprobacion.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onSave(true)} disabled={loading}>
                      {loading ? "Enviando..." : "Confirmar"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {currentStatus === "DRAFT" && selectedProfileIds.length > 0 && (
              <AlertDialog open={showActivateDialog} onOpenChange={setShowActivateDialog}>
                <AlertDialogTrigger asChild>
                  <Button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700">
                    <Play className="h-4 w-4 mr-2" />
                    Activar Directamente
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Activar Campana</AlertDialogTitle>
                    <AlertDialogDescription>
                      La campana sera activada sin pasar por revision del cliente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="py-4">
                    <label htmlFor="activation-reason" className="text-sm font-medium">
                      Motivo (opcional)
                    </label>
                    <Textarea
                      id="activation-reason"
                      placeholder="Ej: Campana negociada previamente..."
                      value={activationReason}
                      onChange={(e) => setActivationReason(e.target.value)}
                      className="mt-2"
                      rows={3}
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setActivationReason("")}>
                      Cancelar
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={handleActivate} disabled={loading}>
                      {loading ? "Activando..." : "Activar"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
