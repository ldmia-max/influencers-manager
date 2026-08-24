import { prisma } from "@/lib/prisma";
import { ValidationError, NotFoundError } from "./errors";

interface ServiceInput {
  /** Ausente en los combos: no salen del tarifario del influencer. */
  profileServiceId?: string;
  quantity: number;
  esCombo?: boolean;
  /** Precio cerrado del combo, escrito a mano al armar la campana. */
  comboPrecio?: number;
  comboDescripcion?: string;
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
  // Los combos no tienen tarifa que consultar: su precio se escribe al
  // armar la campana, asi que se excluyen de esta busqueda.
  const allServiceIds = profiles.flatMap((p) =>
    p.platforms.flatMap((pl) =>
      pl.services
        .filter((s) => !s.esCombo && s.profileServiceId)
        .map((s) => s.profileServiceId!)
    )
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
      select: { profileId: true, status: true, rejectionReason: true },
    });

    const newProfileIds = profiles.map((p) => p.profileId);

    const fuera = currentCampaignProfiles.filter(
      (cp) => !newProfileIds.includes(cp.profileId)
    );

    // A quien el cliente rechazo NO se le borra: se le retira.
    //
    // Su fila es el historial del rechazo —quien fue y por que— y hay
    // que conservarla, pero tampoco puede seguir sumando en el total de
    // la campana. Retirarlo resuelve las dos cosas a la vez, que es
    // justo para lo que existe `participacion`. Borrarlo, en cambio,
    // dejaba a la agencia sin saber a quien se habia propuesto.
    const rechazados = fuera.filter((cp) => cp.status === "REJECTED");
    for (const cp of rechazados) {
      await tx.campaignProfile.updateMany({
        where: { campaignId, profileId: cp.profileId },
        data: {
          participacion: "RETIRADO",
          origenRetiro: "CLIENTE",
          motivoRetiro: cp.rejectionReason,
          retiradoEn: new Date(),
        },
      });
    }

    // Al resto, que solo se quito al editar, si se le borra: no hay nada
    // que recordar de un perfil que nunca llego a proponerse.
    const profileIdsToDelete = fuera
      .filter((cp) => cp.status !== "REJECTED")
      .map((cp) => cp.profileId);

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
          if (serviceInput.esCombo) {
            // El precio viene del formulario, no del tarifario, y la
            // cantidad es siempre 1: un combo es un acuerdo cerrado.
            await tx.campaignService.create({
              data: {
                campaignProfilePlatformId: campaignPlatform.id,
                profileServiceId: null,
                esCombo: true,
                comboDescripcion: serviceInput.comboDescripcion?.trim() || null,
                quantity: 1,
                basePrice: serviceInput.comboPrecio ?? 0,
                currency: "COP",
              },
            });
            continue;
          }

          const profileService = profileServiceMap.get(serviceInput.profileServiceId!)!;

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
