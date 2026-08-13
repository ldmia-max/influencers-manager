import { prisma } from "@/lib/prisma";
import { CampaignProfileStatus } from "@prisma/client";
import { ValidationError, NotFoundError } from "./errors";

function validateToken(approvalToken: {
  expiresAt: Date;
  usedAt: Date | null;
  campaign: { status: string };
} | null) {
  if (!approvalToken) {
    throw new NotFoundError("Token no válido");
  }

  if (new Date() > approvalToken.expiresAt) {
    throw new ValidationError("EXPIRED_TOKEN");
  }

  if (approvalToken.usedAt) {
    throw new ValidationError("USED_TOKEN");
  }

  if (approvalToken.campaign.status !== "REVIEW") {
    throw new ValidationError("INVALID_STATUS");
  }
}

export async function getApprovalData(token: string) {
  const approvalToken = await prisma.campaignApprovalToken.findUnique({
    where: { token },
    include: {
      campaign: {
        include: {
          client: { select: { companyName: true } },
          clientContact: {
            select: { firstName: true, lastName: true, email: true },
          },
          profiles: {
            include: {
              profile: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  country: { select: { name: true } },
                  city: { select: { name: true } },
                  gender: { select: { displayName: true } },
                  department: { select: { name: true } },
                  categories: {
                    include: { category: { select: { name: true } } },
                  },
                },
              },
              platforms: {
                include: {
                  socialAccount: {
                    select: {
                      id: true,
                      username: true,
                      followers: true,
                      profilePicUrl: true,
                      platform: {
                        select: { id: true, name: true, displayName: true },
                      },
                    },
                  },
                  services: {
                    include: {
                      profileService: {
                        include: {
                          serviceType: {
                            select: { id: true, name: true, displayName: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!approvalToken) {
    throw new NotFoundError("Token no válido");
  }

  if (new Date() > approvalToken.expiresAt) {
    throw new ValidationError("EXPIRED_TOKEN");
  }

  if (approvalToken.usedAt) {
    throw new ValidationError("USED_TOKEN");
  }

  if (approvalToken.campaign.status !== "REVIEW") {
    throw new ValidationError("INVALID_STATUS");
  }

  return {
    token: approvalToken.token,
    expiresAt: approvalToken.expiresAt,
    campaign: approvalToken.campaign,
  };
}

export async function saveApprovalDecisions(
  token: string,
  decisions: {
    profiles?: {
      id: string;
      status: CampaignProfileStatus;
      rejectionReason?: string;
    }[];
    platforms?: {
      id: string;
      status: CampaignProfileStatus;
      rejectionReason?: string;
    }[];
    services?: {
      id: string;
      isApproved: boolean;
      rejectionReason?: string;
    }[];
  }
) {
  const approvalToken = await prisma.campaignApprovalToken.findUnique({
    where: { token },
    include: {
      campaign: { select: { id: true, status: true } },
    },
  });

  validateToken(approvalToken);

  const now = new Date();

  if (decisions.profiles && decisions.profiles.length > 0) {
    for (const profile of decisions.profiles) {
      await prisma.campaignProfile.update({
        where: { id: profile.id },
        data: {
          status: profile.status,
          rejectionReason: profile.rejectionReason || null,
          reviewedAt: now,
        },
      });
    }
  }

  if (decisions.platforms && decisions.platforms.length > 0) {
    for (const platform of decisions.platforms) {
      await prisma.campaignProfilePlatform.update({
        where: { id: platform.id },
        data: {
          status: platform.status,
          rejectionReason: platform.rejectionReason || null,
          reviewedAt: now,
        },
      });
    }
  }

  if (decisions.services && decisions.services.length > 0) {
    for (const service of decisions.services) {
      await prisma.campaignService.update({
        where: { id: service.id },
        data: {
          isApproved: service.isApproved,
          rejectionReason: service.rejectionReason || null,
          reviewedAt: now,
        },
      });
    }
  }
}

export async function submitApproval(
  token: string,
  finalDecisions: {
    profiles: {
      id: string;
      status: CampaignProfileStatus;
      rejectionReason?: string;
    }[];
    platforms: {
      id: string;
      status: CampaignProfileStatus;
      rejectionReason?: string;
    }[];
    services: {
      id: string;
      isApproved: boolean;
      rejectionReason?: string;
      clientNotes?: string;
    }[];
  }
) {
  const approvalToken = await prisma.campaignApprovalToken.findUnique({
    where: { token },
    include: {
      campaign: {
        select: {
          id: true,
          name: true,
          status: true,
          createdById: true,
          client: { select: { companyName: true } },
          clientContact: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  validateToken(approvalToken);

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    for (const profile of finalDecisions.profiles) {
      await tx.campaignProfile.update({
        where: { id: profile.id },
        data: {
          status: profile.status,
          rejectionReason: profile.rejectionReason || null,
          reviewedAt: now,
        },
      });
    }

    for (const platform of finalDecisions.platforms) {
      await tx.campaignProfilePlatform.update({
        where: { id: platform.id },
        data: {
          status: platform.status,
          rejectionReason: platform.rejectionReason || null,
          reviewedAt: now,
        },
      });
    }

    for (const service of finalDecisions.services) {
      await tx.campaignService.update({
        where: { id: service.id },
        data: {
          isApproved: service.isApproved,
          clientNotes: service.clientNotes || null,
          rejectionReason: service.rejectionReason || null,
          reviewedAt: now,
        },
      });
    }

    await tx.campaignApprovalToken.update({
      where: { id: approvalToken!.id },
      data: { usedAt: now },
    });

    const hasRejections =
      finalDecisions.profiles.some((p) => p.status === "REJECTED") ||
      finalDecisions.platforms.some((p) => p.status === "REJECTED") ||
      finalDecisions.services.some((s) => !s.isApproved);

    const newStatus = hasRejections ? "PENDING" : "ACTIVE";

    await tx.campaign.update({
      where: { id: approvalToken!.campaignId },
      data: { status: newStatus },
    });
  });

  const summary = {
    totalProfiles: finalDecisions.profiles.length,
    approvedProfiles: finalDecisions.profiles.filter((p) => p.status === "APPROVED").length,
    rejectedProfiles: finalDecisions.profiles.filter((p) => p.status === "REJECTED").length,
    totalPlatforms: finalDecisions.platforms.length,
    approvedPlatforms: finalDecisions.platforms.filter((p) => p.status === "APPROVED").length,
    rejectedPlatforms: finalDecisions.platforms.filter((p) => p.status === "REJECTED").length,
    totalServices: finalDecisions.services.length,
    approvedServices: finalDecisions.services.filter((s) => s.isApproved).length,
    rejectedServices: finalDecisions.services.filter((s) => !s.isApproved).length,
  };

  return {
    summary,
    emailData: {
      campaignId: approvalToken!.campaign.id,
      campaignName: approvalToken!.campaign.name,
      clientName: approvalToken!.campaign.client.companyName,
      contactName: `${approvalToken!.campaign.clientContact.firstName} ${approvalToken!.campaign.clientContact.lastName}`,
      createdById: approvalToken!.campaign.createdById,
      rejectedProfileIds: finalDecisions.profiles
        .filter((p) => p.status === "REJECTED")
        .map((p) => p.id),
    },
  };
}

export async function getRejectedProfileDetails(profileIds: string[]) {
  return prisma.campaignProfile.findMany({
    where: { id: { in: profileIds } },
    select: {
      rejectionReason: true,
      profile: { select: { name: true } },
    },
  });
}
