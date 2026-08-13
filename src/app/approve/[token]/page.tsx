"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiGet, ApiError } from "@/services/api";
import { useSubmitApproval } from "@/hooks/mutations/use-approval-mutations";
import { ApprovalHeader } from "@/components/approve/approval-header";
import { ProfileCard, PlatformData } from "@/components/approve/profile-card";
import { ApprovalSummary } from "@/components/approve/approval-summary";
import { ApprovalCharts } from "@/components/approve/approval-charts";
import { RejectionDialog } from "@/components/approve/rejection-dialog";
import { calculateMarkupPrice } from "@/lib/campaign-utils";
import { calculateReach } from "@/lib/format";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

interface CampaignData {
  token: string;
  expiresAt: string;
  campaign: {
    id: string;
    name: string;
    description?: string;
    budget: string;
    currency: string;
    client: {
      companyName: string;
    };
    clientContact: {
      firstName: string;
      lastName: string;
      email: string;
    };
    profiles: Array<{
      id: string;
      status: string;
      profile: {
        id: string;
        name: string;
        type: string;
        country?: { name: string } | null;
        city?: { name: string } | null;
        gender?: { displayName: string } | null;
        department?: { name: string } | null;
        categories?: Array<{ category: { name: string } }>;
      };
      platforms: Array<{
        id: string;
        status: string;
        socialAccount: {
          id: string;
          username: string;
          followers?: number;
          profilePicUrl?: string;
          platform: {
            id: string;
            name: string;
            displayName: string;
          };
        };
        services: Array<{
          id: string;
          quantity: number;
          basePrice: string;
          currency: string;
          isApproved: boolean;
          clientNotes?: string;
          profileService: {
            serviceType: {
              id: string;
              name: string;
              displayName: string;
            };
          };
        }>;
      }>;
    }>;
  };
}

interface ApprovalState {
  profiles: Record<string, { isApproved: boolean; rejectionReason?: string }>;
  platforms: Record<string, { isApproved: boolean; rejectionReason?: string }>;
  services: Record<
    string,
    { isApproved: boolean; rejectionReason?: string; clientNotes?: string }
  >;
}

export default function ApprovePage() {
  const params = useParams();
  const token = params.token as string;

  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useQuery<CampaignData>({
    queryKey: queryKeys.approval.data(token),
    queryFn: () => apiGet<CampaignData>(`/api/public/approve/${token}`),
    enabled: !!token,
    retry: false,
  });
  const submitMutation = useSubmitApproval(token);
  const [approvalState, setApprovalState] = useState<ApprovalState>({
    profiles: {},
    platforms: {},
    services: {},
  });
  const [approvalInitialized, setApprovalInitialized] = useState(false);

  // Derive error object for UI
  const error = queryError
    ? {
        message: queryError instanceof ApiError ? queryError.message : "Error al cargar los datos",
        code: queryError instanceof ApiError ? String(queryError.status) : "FETCH_ERROR",
      }
    : submitMutation.error
    ? { message: submitMutation.error.message, code: "SUBMIT_ERROR" }
    : null;

  // Initialize approval state once data loads
  if (data && !approvalInitialized) {
    const initialState: ApprovalState = {
      profiles: {},
      platforms: {},
      services: {},
    };

    data.campaign.profiles.forEach(
      (profile: CampaignData["campaign"]["profiles"][0]) => {
        initialState.profiles[profile.id] = {
          isApproved: profile.status !== "REJECTED",
        };

        profile.platforms.forEach((platform) => {
          initialState.platforms[platform.id] = {
            isApproved: platform.status !== "REJECTED",
          };

          platform.services.forEach((service) => {
            initialState.services[service.id] = {
              isApproved: service.isApproved,
              clientNotes: service.clientNotes ?? undefined,
            };
          });
        });
      },
    );

    setApprovalState(initialState);
    setApprovalInitialized(true);
  }

  // Photo lightbox state
  const [lightbox, setLightbox] = useState<{
    open: boolean;
    src: string;
    name: string;
  }>({ open: false, src: "", name: "" });

  // Rejection dialog state
  const [rejectionDialog, setRejectionDialog] = useState<{
    open: boolean;
    itemType: "profile" | "platform" | "service" | "all";
    itemId?: string;
    itemName?: string;
  }>({
    open: false,
    itemType: "all",
  });

  // Calculate totals
  const calculateTotals = useCallback(() => {
    if (!data) return { original: 0, approved: 0, removed: 0 };

    let original = 0;
    let approved = 0;

    data.campaign.profiles.forEach((profile) => {
      profile.platforms.forEach((platform) => {
        platform.services.forEach((service) => {
          const markupPrice = calculateMarkupPrice(Number(service.basePrice));
          const total = markupPrice * service.quantity;
          original += total;

          const profileApproved =
            approvalState.profiles[profile.id]?.isApproved ?? true;
          const platformApproved =
            approvalState.platforms[platform.id]?.isApproved ?? true;
          const serviceApproved =
            approvalState.services[service.id]?.isApproved ?? true;

          if (profileApproved && platformApproved && serviceApproved) {
            approved += total;
          }
        });
      });
    });

    return { original, approved, removed: original - approved };
  }, [data, approvalState]);

  // Get counts
  const getCounts = useCallback(() => {
    if (!data)
      return {
        profiles: 0,
        approvedProfiles: 0,
        services: 0,
        approvedServices: 0,
      };

    let profiles = 0;
    let approvedProfiles = 0;
    let services = 0;
    let approvedServices = 0;

    data.campaign.profiles.forEach((profile) => {
      profiles++;
      const profileApproved =
        approvalState.profiles[profile.id]?.isApproved ?? true;
      if (profileApproved) approvedProfiles++;

      profile.platforms.forEach((platform) => {
        const platformApproved =
          approvalState.platforms[platform.id]?.isApproved ?? true;

        platform.services.forEach((service) => {
          services++;
          const serviceApproved =
            approvalState.services[service.id]?.isApproved ?? true;

          if (profileApproved && platformApproved && serviceApproved) {
            approvedServices++;
          }
        });
      });
    });

    return { profiles, approvedProfiles, services, approvedServices };
  }, [data, approvalState]);

  // Handlers
  const handleProfileToggle = (profileId: string, isApproved: boolean) => {
    setApprovalState((prev) => ({
      ...prev,
      profiles: {
        ...prev.profiles,
        [profileId]: { ...prev.profiles[profileId], isApproved },
      },
    }));
  };

  const handlePlatformToggle = (platformId: string, isApproved: boolean) => {
    setApprovalState((prev) => ({
      ...prev,
      platforms: {
        ...prev.platforms,
        [platformId]: { ...prev.platforms[platformId], isApproved },
      },
    }));
  };

  const handleServiceToggle = (serviceId: string, isApproved: boolean) => {
    setApprovalState((prev) => ({
      ...prev,
      services: {
        ...prev.services,
        [serviceId]: { ...prev.services[serviceId], isApproved },
      },
    }));
  };

  const handleServiceNotesChange = (serviceId: string, notes: string) => {
    setApprovalState((prev) => ({
      ...prev,
      services: {
        ...prev.services,
        [serviceId]: { ...prev.services[serviceId], clientNotes: notes },
      },
    }));
  };

  const handleApproveAll = () => {
    if (!data) return;

    const newState: ApprovalState = {
      profiles: {},
      platforms: {},
      services: {},
    };

    data.campaign.profiles.forEach((profile) => {
      newState.profiles[profile.id] = { isApproved: true };
      profile.platforms.forEach((platform) => {
        newState.platforms[platform.id] = { isApproved: true };
        platform.services.forEach((service) => {
          newState.services[service.id] = {
            isApproved: true,
            clientNotes: approvalState.services[service.id]?.clientNotes,
          };
        });
      });
    });

    setApprovalState(newState);
  };

  const handleRejectAll = () => {
    setRejectionDialog({
      open: true,
      itemType: "all",
    });
  };

  const handleRejectAllConfirm = (reason: string) => {
    if (!data) return;

    const newState: ApprovalState = {
      profiles: {},
      platforms: {},
      services: {},
    };

    data.campaign.profiles.forEach((profile) => {
      newState.profiles[profile.id] = {
        isApproved: false,
        rejectionReason: reason,
      };
      profile.platforms.forEach((platform) => {
        newState.platforms[platform.id] = {
          isApproved: false,
          rejectionReason: reason,
        };
        platform.services.forEach((service) => {
          newState.services[service.id] = {
            isApproved: false,
            rejectionReason: reason,
            clientNotes: approvalState.services[service.id]?.clientNotes,
          };
        });
      });
    });

    setApprovalState(newState);
  };

  const handleSubmit = () => {
    if (!data) return;

    const finalDecisions = {
      profiles: data.campaign.profiles.map((profile) => ({
        id: profile.id,
        status: approvalState.profiles[profile.id]?.isApproved
          ? "APPROVED" as const
          : "REJECTED" as const,
        rejectionReason: approvalState.profiles[profile.id]?.rejectionReason,
      })),
      platforms: data.campaign.profiles.flatMap((profile) =>
        profile.platforms.map((platform) => ({
          id: platform.id,
          status: approvalState.platforms[platform.id]?.isApproved
            ? "APPROVED" as const
            : "REJECTED" as const,
          rejectionReason:
            approvalState.platforms[platform.id]?.rejectionReason,
        })),
      ),
      services: data.campaign.profiles.flatMap((profile) =>
        profile.platforms.flatMap((platform) =>
          platform.services.map((service) => ({
            id: service.id,
            isApproved:
              approvalState.services[service.id]?.isApproved ?? true,
            rejectionReason:
              approvalState.services[service.id]?.rejectionReason,
            clientNotes: approvalState.services[service.id]?.clientNotes,
          })),
        ),
      ),
    };

    submitMutation.mutate(finalDecisions);
  };

  // Transform data for components
  const transformPlatforms = (
    platforms: CampaignData["campaign"]["profiles"][0]["platforms"],
  ): PlatformData[] => {
    return platforms.map((platform) => ({
      id: platform.id,
      platformName: platform.socialAccount.platform.displayName,
      username: platform.socialAccount.username,
      followers: platform.socialAccount.followers ?? undefined,
      isApproved: approvalState.platforms[platform.id]?.isApproved ?? true,
      services: platform.services.map((service) => ({
        id: service.id,
        serviceName: service.profileService.serviceType.displayName,
        quantity: service.quantity,
        basePrice: Number(service.basePrice),
        currency: service.currency,
        isApproved: approvalState.services[service.id]?.isApproved ?? true,
        clientNotes: approvalState.services[service.id]?.clientNotes,
      })),
    }));
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando campaña...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-6 w-6" />
              <CardTitle>Error</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error.message}</p>
            {error.code === "EXPIRED_TOKEN" && (
              <p className="mt-2 text-sm text-muted-foreground">
                Por favor, contacta al gestor de la campaña para solicitar un
                nuevo enlace.
              </p>
            )}
            {error.code === "USED_TOKEN" && (
              <p className="mt-2 text-sm text-muted-foreground">
                Ya has enviado tu aprobación para esta campaña.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (submitMutation.isSuccess) {
    const counts = getCounts();
    const totals = calculateTotals();

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              <CardTitle>Aprobación Enviada</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Tu aprobación ha sido enviada correctamente.
            </p>
            <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Perfiles aprobados:</span>
                <span className="font-medium">
                  {counts.approvedProfiles} / {counts.profiles}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Formatos aprobados:</span>
                <span className="font-medium">
                  {counts.approvedServices} / {counts.services}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2 mt-2">
                <span>Total aprobado:</span>
                <span className="font-semibold">
                  ${Math.round(totals.approved).toLocaleString("es-CO")}{" "}
                  {data?.campaign.currency}
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              El equipo revisará tus comentarios y se pondrá en contacto contigo
              pronto.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main content
  if (!data) return null;

  const totals = calculateTotals();
  const counts = getCounts();

  // Compute chart data
  const formatCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const genderCounts = new Map<string, number>();
  const departmentCounts = new Map<string, number>();
  let totalReach = 0;
  const accountsSeen = new Set<string>();

  data.campaign.profiles.forEach((cp) => {
    const p = cp.profile;
    if (p.gender) {
      genderCounts.set(
        p.gender.displayName,
        (genderCounts.get(p.gender.displayName) || 0) + 1,
      );
    }
    if (p.department) {
      departmentCounts.set(
        p.department.name,
        (departmentCounts.get(p.department.name) || 0) + 1,
      );
    }
    p.categories?.forEach((pc) => {
      categoryCounts.set(
        pc.category.name,
        (categoryCounts.get(pc.category.name) || 0) + 1,
      );
    });

    cp.platforms.forEach((plat) => {
      plat.services.forEach((s) => {
        const fname = s.profileService.serviceType.displayName;
        formatCounts.set(fname, (formatCounts.get(fname) || 0) + s.quantity);
      });
      if (!accountsSeen.has(plat.socialAccount.id)) {
        accountsSeen.add(plat.socialAccount.id);
        const reach = calculateReach(plat.socialAccount.followers ?? null);
        if (reach) totalReach += reach;
      }
    });
  });

  const chartData = {
    formats: [...formatCounts.entries()].map(([name, value]) => ({
      name,
      value,
    })),
    categories: [...categoryCounts.entries()].map(([name, value]) => ({
      name,
      value,
    })),
    genders: [...genderCounts.entries()].map(([name, value]) => ({
      name,
      value,
    })),
    departments: [...departmentCounts.entries()].map(([name, value]) => ({
      name,
      value,
    })),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <ApprovalHeader />

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Influencer Avatars Strip */}
        <Card className="w-full">
          <CardContent className="py-4">
            <div className="space-y-3">
              <span className="text-sm font-medium text-muted-foreground">
                {data.campaign.profiles.length} Influencers
              </span>
              <div className="flex flex-wrap gap-3 p-1">
                {data.campaign.profiles.map((cp) => {
                  const picUrl = cp.platforms[0]?.socialAccount.profilePicUrl;
                  const initials = cp.profile.name
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .substring(0, 2)
                    .toUpperCase();

                  return (
                    <div
                      key={cp.id}
                      className="flex flex-col items-center gap-1"
                    >
                      <Avatar
                        className="h-18 w-18 border-2 border-white ring-1 ring-gray-200 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                        onClick={() =>
                          picUrl &&
                          setLightbox({
                            open: true,
                            src: picUrl,
                            name: cp.profile.name,
                          })
                        }
                      >
                        <AvatarImage src={picUrl ?? ""} alt={cp.profile.name} />
                        <AvatarFallback className="text-sm bg-gray-100">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground max-w-[72px] truncate text-center">
                        {cp.profile.name.split(" ")[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Charts - full width row */}
        <ApprovalCharts
          formats={chartData.formats}
          categories={chartData.categories}
          genders={chartData.genders}
          departments={chartData.departments}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Profiles List */}
          <div className="lg:col-span-7 space-y-4">
            <h2 className="text-lg font-semibold">
              Perfiles ({data.campaign.profiles.length})
            </h2>
            {data.campaign.profiles.map((profile) => {
              const profilePicUrl =
                profile.platforms.find((p) => p.socialAccount.profilePicUrl)
                  ?.socialAccount.profilePicUrl ?? undefined;
              return (
                <ProfileCard
                  key={profile.id}
                  id={profile.id}
                  profileName={profile.profile.name}
                  profileType={profile.profile.type}
                  profilePicUrl={profilePicUrl}
                  country={profile.profile.country?.name ?? undefined}
                  city={profile.profile.department?.name ?? undefined}
                  categories={
                    profile.profile.categories?.map((c) => c.category.name) ??
                    []
                  }
                  isApproved={
                    approvalState.profiles[profile.id]?.isApproved ?? true
                  }
                  platforms={transformPlatforms(profile.platforms)}
                  onProfileToggle={handleProfileToggle}
                  onPlatformToggle={handlePlatformToggle}
                  onServiceToggle={handleServiceToggle}
                  onServiceNotesChange={handleServiceNotesChange}
                />
              );
            })}
          </div>

          {/* Sidebar: Summary (sticky) */}
          <div className="lg:col-span-5">
            <div className="sticky top-4">
              <ApprovalSummary
                campaignName={data.campaign.name}
                clientName={data.campaign.client.companyName}
                contactName={`${data.campaign.clientContact.firstName} ${data.campaign.clientContact.lastName}`}
                budget={Number(data.campaign.budget)}
                expiresAt={new Date(data.expiresAt)}
                originalTotal={totals.original}
                approvedTotal={totals.approved}
                removedTotal={totals.removed}
                currency={data.campaign.currency}
                profilesCount={counts.profiles}
                approvedProfilesCount={counts.approvedProfiles}
                servicesCount={counts.services}
                approvedServicesCount={counts.approvedServices}
                totalReach={totalReach}
                onApproveAll={handleApproveAll}
                onRejectAll={handleRejectAll}
                onSubmit={handleSubmit}
                isSubmitting={submitMutation.isPending}
              />
            </div>
          </div>
        </div>
      </main>

      <RejectionDialog
        open={rejectionDialog.open}
        onOpenChange={(open) =>
          setRejectionDialog((prev) => ({ ...prev, open }))
        }
        itemType={rejectionDialog.itemType}
        itemName={rejectionDialog.itemName}
        onConfirm={handleRejectAllConfirm}
      />

      <Dialog
        open={lightbox.open}
        onOpenChange={(open) => setLightbox((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-md p-2">
          <DialogTitle className="text-center text-sm font-medium">
            {lightbox.name}
          </DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.src}
            alt={lightbox.name}
            className="w-full h-auto rounded-lg"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
