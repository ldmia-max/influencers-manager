import { prisma } from "@/lib/prisma";
import { ValidationError, NotFoundError } from "./errors";

interface ServiceInput {
  profileServiceId: string;
  quantity: number;
}

interface PlatformInput {
  socialAccountId: string;
  services: ServiceInput[];
}

interface ProfileInput {
  profileId: string;
  platforms: PlatformInput[];
}

export async function getCampaignProfiles(campaignId: string) {
  return prisma.campaignProfile.findMany({
    where: { campaignId },
    include: {
      profile: {
        include: {
          socialAccounts: {
            include: {
              platform: true,
              services: { include: { serviceType: true } },
            },
          },
          categories: { include: { category: true } },
        },
      },
      platforms: {
        include: {
          socialAccount: { include: { platform: true } },
          services: {
            include: {
              profileService: { include: { serviceType: true } },
            },
          },
        },
      },
    },
  });
}

export async function setCampaignProfiles(
  campaignId: string,
  profiles: ProfileInput[]
) {
  // If no profiles, clear all
  if (!profiles || profiles.length === 0) {
    await prisma.campaignProfile.deleteMany({ where: { campaignId } });
    return [];
  }

  // Validate profiles exist
  const profileIds = profiles.map((p) => p.profileId);
  const existingProfiles = await prisma.profile.findMany({
    where: { id: { in: profileIds } },
    include: { socialAccounts: { include: { services: true } } },
  });

  if (existingProfiles.length !== profileIds.length) {
    throw new ValidationError("Algunos perfiles no existen");
  }

  // Load all profile services for price lookup
  const allServiceIds = profiles.flatMap((p) =>
    p.platforms.flatMap((pl) => pl.services.map((s) => s.profileServiceId))
  );

  const profileServicesData = await prisma.profileService.findMany({
    where: { id: { in: allServiceIds } },
  });

  const profileServiceMap = new Map(
    profileServicesData.map((ps) => [ps.id, ps])
  );

  for (const serviceId of allServiceIds) {
    if (!profileServiceMap.has(serviceId)) {
      throw new ValidationError(`Formato no encontrado: ${serviceId}`);
    }
  }

  // Execute in transaction
  return prisma.$transaction(async (tx) => {
    const currentCampaignProfiles = await tx.campaignProfile.findMany({
      where: { campaignId },
      select: { profileId: true },
    });

    const currentProfileIds = currentCampaignProfiles.map((cp) => cp.profileId);
    const newProfileIds = profiles.map((p) => p.profileId);

    // Delete profiles no longer in the list
    const profileIdsToDelete = currentProfileIds.filter(
      (id) => !newProfileIds.includes(id)
    );

    if (profileIdsToDelete.length > 0) {
      await tx.campaignProfile.deleteMany({
        where: { campaignId, profileId: { in: profileIdsToDelete } },
      });
    }

    const createdProfiles = [];

    for (const profileInput of profiles) {
      const existingCampaignProfile = await tx.campaignProfile.findUnique({
        where: {
          campaignId_profileId: {
            campaignId,
            profileId: profileInput.profileId,
          },
        },
      });

      if (existingCampaignProfile) {
        await tx.campaignProfilePlatform.deleteMany({
          where: { campaignProfileId: existingCampaignProfile.id },
        });
      }

      const campaignProfile = existingCampaignProfile
        ? existingCampaignProfile
        : await tx.campaignProfile.create({
            data: { campaignId, profileId: profileInput.profileId },
          });

      for (const platformInput of profileInput.platforms) {
        const campaignPlatform = await tx.campaignProfilePlatform.create({
          data: {
            campaignProfileId: campaignProfile.id,
            socialAccountId: platformInput.socialAccountId,
          },
        });

        for (const serviceInput of platformInput.services) {
          const profileService = profileServiceMap.get(serviceInput.profileServiceId)!;

          await tx.campaignService.create({
            data: {
              campaignProfilePlatformId: campaignPlatform.id,
              profileServiceId: serviceInput.profileServiceId,
              quantity: serviceInput.quantity,
              basePrice: profileService.price,
              currency: profileService.currency,
            },
          });
        }
      }

      createdProfiles.push(campaignProfile);
    }

    return createdProfiles;
  });
}

export async function removeCampaignProfiles(
  campaignId: string,
  profileIds: string[]
) {
  if (!profileIds || profileIds.length === 0) {
    throw new ValidationError("Se requiere al menos un perfil para eliminar");
  }

  await prisma.campaignProfile.deleteMany({
    where: { campaignId, profileId: { in: profileIds } },
  });
}
