import { prisma } from "@/lib/prisma";
import { cacheLife, cacheTag } from "next/cache";
import { revalidateTag } from "next/cache";
import type { Prisma, Profile, ProfileType } from "@prisma/client";
import { ValidationError, NotFoundError } from "./errors";
import { normalizarUsuarioSocial } from "@/lib/social-handles";

// --- Types ---

type PrismaProfileWithRelations = Prisma.ProfileGetPayload<{
  include: {
    gender: true;
    country: true;
    department: true;
    city: true;
    categories: { include: { category: true } };
    socialAccounts: {
      include: {
        platform: true;
        services: { include: { serviceType: true } };
      };
    };
    createdBy: { select: { name: true } };
  };
}>;

export type ProfileWithRelations = Omit<PrismaProfileWithRelations, "socialAccounts"> & {
  socialAccounts: (Omit<PrismaProfileWithRelations["socialAccounts"][number], "services"> & {
    services: (Omit<
      PrismaProfileWithRelations["socialAccounts"][number]["services"][number],
      "price"
    > & {
      price: string;
    })[];
  })[];
};

export interface ProfileFilters {
  search?: string;
  countryId?: string;
  departmentId?: string;
  cityId?: string;
  type?: ProfileType;
  genderId?: string;
  platformIds?: string[];
  categoryIds?: string[];
  serviceIds?: string[];
  minPrice?: number;
  maxPrice?: number;
  minEngagement?: number;
  maxEngagement?: number;
  minFollowers?: number;
  maxFollowers?: number;
  page?: number;
  pageSize?: number;
}

// --- Helpers ---

function serializeProfile(profile: PrismaProfileWithRelations) {
  return {
    ...profile,
    socialAccounts: profile.socialAccounts.map((account) => ({
      ...account,
      services: account.services.map((service) => ({
        ...service,
        price: service.price.toString(),
      })),
    })),
  };
}

const PROFILE_FULL_INCLUDE = {
  gender: true,
  country: true,
  department: true,
  city: true,
  categories: { include: { category: true } },
  socialAccounts: {
    include: {
      platform: true,
      services: { include: { serviceType: true } },
    },
  },
  createdBy: { select: { name: true } },
} as const;

const PROFILE_API_INCLUDE = {
  gender: true,
  country: true,
  department: true,
  city: true,
  categories: { include: { category: true } },
  socialAccounts: {
    include: {
      platform: true,
      services: { include: { serviceType: true } },
    },
  },
} as const;

const TYPE_ORDER: Record<ProfileType, number> = {
  INFLUENCER: 0,
  UGC: 1,
  BOTH: 2,
};

function sortProfiles<T extends Pick<Profile, "type" | "name">>(profiles: T[]): T[] {
  return profiles.sort((a, b) => {
    const typeDiff = TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
    if (typeDiff !== 0) return typeDiff;
    return a.name.localeCompare(b.name);
  });
}

// --- Cached functions ---

export async function getCachedProfiles(
  userId: string,
  isAdmin: boolean,
  filters: ProfileFilters
) {
  "use cache";
  cacheLife("hours");
  cacheTag("profiles");

  const page = filters.page || 1;
  const pageSize = filters.pageSize || 10;
  const skip = (page - 1) * pageSize;

  const where = {
    AND: [
      {},
      filters.search
        ? {
            OR: [
              {
                name: {
                  contains: filters.search,
                  mode: "insensitive" as Prisma.QueryMode,
                },
              },
              {
                socialAccounts: {
                  some: {
                    username: {
                      contains: filters.search,
                      mode: "insensitive" as Prisma.QueryMode,
                    },
                  },
                },
              },
            ],
          }
        : {},
      filters.countryId ? { countryId: filters.countryId } : {},
      filters.departmentId ? { departmentId: filters.departmentId } : {},
      filters.cityId ? { cityId: filters.cityId } : {},
      filters.type ? { type: filters.type } : {},
      filters.genderId ? { genderId: filters.genderId } : {},
      filters.platformIds && filters.platformIds.length > 0
        ? { socialAccounts: { some: { platformId: { in: filters.platformIds } } } }
        : {},
      filters.categoryIds && filters.categoryIds.length > 0
        ? { categories: { some: { categoryId: { in: filters.categoryIds } } } }
        : {},
      filters.serviceIds && filters.serviceIds.length > 0
        ? {
            socialAccounts: {
              some: {
                services: {
                  some: { serviceTypeId: { in: filters.serviceIds } },
                },
              },
            },
          }
        : {},
      filters.minPrice !== undefined || filters.maxPrice !== undefined
        ? {
            socialAccounts: {
              some: {
                services: {
                  some: {
                    AND: [
                      filters.minPrice !== undefined ? { price: { gte: filters.minPrice } } : {},
                      filters.maxPrice !== undefined ? { price: { lte: filters.maxPrice } } : {},
                    ],
                  },
                },
              },
            },
          }
        : {},
      filters.minEngagement !== undefined || filters.maxEngagement !== undefined
        ? {
            socialAccounts: {
              some: {
                AND: [
                  filters.minEngagement !== undefined
                    ? { engagementRate: { gte: filters.minEngagement } }
                    : {},
                  filters.maxEngagement !== undefined
                    ? { engagementRate: { lte: filters.maxEngagement } }
                    : {},
                ],
              },
            },
          }
        : {},
      filters.minFollowers !== undefined || filters.maxFollowers !== undefined
        ? {
            socialAccounts: {
              some: {
                AND: [
                  filters.minFollowers !== undefined
                    ? { followers: { gte: filters.minFollowers } }
                    : {},
                  filters.maxFollowers !== undefined
                    ? { followers: { lte: filters.maxFollowers } }
                    : {},
                ],
              },
            },
          }
        : {},
    ],
  };

  const [profiles, total] = await Promise.all([
    prisma.profile.findMany({
      where,
      orderBy: [{ type: "asc" }, { name: "asc" }],
      skip,
      take: pageSize,
      include: PROFILE_FULL_INCLUDE,
    }),
    prisma.profile.count({ where }),
  ]);

  return {
    profiles: profiles.map(serializeProfile),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getCachedProfile(id: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("profiles", `profile-${id}`);

  const profile = await prisma.profile.findUnique({
    where: { id },
    include: PROFILE_FULL_INCLUDE,
  });

  return profile ? serializeProfile(profile) : null;
}

// --- Queries for campaign editor ---

export async function getAllProfilesForEditor() {
  const profilesRaw = await prisma.profile.findMany({
    orderBy: { name: "asc" },
    include: {
      gender: true,
      country: true,
      department: true,
      city: true,
      socialAccounts: {
        include: {
          platform: true,
          services: { include: { serviceType: true } },
        },
      },
      categories: { include: { category: true } },
    },
  });

  return profilesRaw.map((profile) => ({
    ...profile,
    socialAccounts: profile.socialAccounts.map((sa) => ({
      ...sa,
      services: sa.services.map((s) => ({
        ...s,
        price: Number(s.price),
      })),
    })),
  }));
}

// --- API queries ---

export async function getProfilesPaginated(
  where: Prisma.ProfileWhereInput | undefined,
  page: number,
  pageSize: number
) {
  const skip = (page - 1) * pageSize;

  const [profiles, total] = await Promise.all([
    prisma.profile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: PROFILE_API_INCLUDE,
    }),
    prisma.profile.count({ where }),
  ]);

  return {
    profiles: sortProfiles(profiles),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getProfilesAll(where: Prisma.ProfileWhereInput | undefined) {
  const profiles = await prisma.profile.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: PROFILE_API_INCLUDE,
  });

  return sortProfiles(profiles);
}

export async function getProfileById(id: string) {
  const profile = await prisma.profile.findUnique({
    where: { id },
    include: {
      gender: true,
      country: true,
      department: true,
      city: true,
      categories: { include: { category: true } },
      socialAccounts: {
        include: {
          platform: true,
          services: { include: { serviceType: true } },
        },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!profile) {
    throw new NotFoundError("Perfil no encontrado");
  }

  return profile;
}

export async function getProfileForEdit(id: string) {
  const profile = await prisma.profile.findUnique({
    where: { id },
    include: {
      categories: true,
      socialAccounts: {
        include: { services: true },
      },
    },
  });

  if (!profile) {
    throw new NotFoundError("Perfil no encontrado");
  }

  return profile;
}

export async function getProfileCount(where?: Prisma.ProfileWhereInput) {
  return prisma.profile.count(where ? { where } : undefined);
}

// --- Mutations ---


/**
 * Deja el identificador de cada cuenta social como debe guardarse.
 *
 * Quien da de alta un creador copia la URL desde la propia plataforma,
 * porque es donde tiene el perfil delante. Se normaliza AQUI, en la
 * unica puerta por la que pasan todas las escrituras, y no en cada ruta
 * o formulario: asi ninguna via puede colarse sin limpiar.
 *
 * Importa mas de lo que parece: ese texto no solo alimenta a Apify,
 * tambien construye los enlaces al perfil que ve el cliente en el
 * portal de aprobacion.
 */
async function normalizarCuentas<T extends { platformId: string; username: string }>(
  cuentas: T[]
): Promise<T[]> {
  if (cuentas.length === 0) return cuentas;

  const plataformas = await prisma.socialPlatform.findMany({
    where: { id: { in: cuentas.map((c) => c.platformId) } },
    select: { id: true, name: true },
  });
  const nombrePorId = new Map(plataformas.map((p) => [p.id, p.name]));

  return cuentas.map((c) => ({
    ...c,
    username: normalizarUsuarioSocial(nombrePorId.get(c.platformId) ?? "", c.username),
  }));
}

export async function createProfile(data: {
  name: string;
  email?: string | null;
  phone?: string | null;
  type: ProfileType;
  countryId?: string | null;
  departmentId?: string | null;
  cityId?: string | null;
  genderId?: string | null;
  createdById: string;
  socialAccounts: {
    platformId: string;
    username: string;
    services: {
      serviceTypeId: string;
      price: number;
      currency?: string;
    }[];
  }[];
  categoryIds: string[];
}) {
  const socialAccounts = await normalizarCuentas(data.socialAccounts);

  const profile = await prisma.profile.create({
    data: {
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      type: data.type,
      countryId: data.countryId || null,
      departmentId: data.departmentId || null,
      cityId: data.cityId || null,
      genderId: data.genderId || null,
      createdById: data.createdById,
      socialAccounts: {
        create: socialAccounts.map((sa) => ({
          username: sa.username,
          platformId: sa.platformId,
          services: {
            create: sa.services.map((s) => ({
              serviceTypeId: s.serviceTypeId,
              price: s.price,
              currency: s.currency || "COP",
            })),
          },
        })),
      },
      categories: {
        create: data.categoryIds.map((categoryId) => ({
          categoryId,
        })),
      },
    },
    include: PROFILE_API_INCLUDE,
  });

  revalidateTag("profiles", "hours");
  return profile;
}

export async function updateProfile(
  id: string,
  data: {
    name: string;
    email?: string | null;
    phone?: string | null;
    type: ProfileType;
    countryId?: string | null;
    departmentId?: string | null;
    cityId?: string | null;
    genderId?: string | null;
    socialAccounts: {
      platformId: string;
      username: string;
      services: {
        serviceTypeId: string;
        price: number;
        currency?: string;
      }[];
    }[];
    categoryIds: string[];
  }
) {
  const existingProfile = await prisma.profile.findUnique({ where: { id } });

  if (!existingProfile) {
    throw new NotFoundError("Perfil no encontrado");
  }

  const profile = await prisma.$transaction(async (tx) => {
    await tx.profile.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        type: data.type,
        countryId: data.countryId || null,
        departmentId: data.departmentId || null,
        cityId: data.cityId || null,
        genderId: data.genderId || null,
      },
    });

    await tx.profileCategory.deleteMany({ where: { profileId: id } });
    if (data.categoryIds.length > 0) {
      await tx.profileCategory.createMany({
        data: data.categoryIds.map((categoryId) => ({
          profileId: id,
          categoryId,
        })),
      });
    }

    const existingAccounts = await tx.socialAccount.findMany({
      where: { profileId: id },
      include: { services: true },
    });

    const newPlatformIds = new Set(data.socialAccounts.map((sa) => sa.platformId));

    for (const existingAccount of existingAccounts) {
      if (!newPlatformIds.has(existingAccount.platformId)) {
        const campaignServiceCount = await tx.campaignService.count({
          where: { profileService: { socialAccountId: existingAccount.id } },
        });

        if (campaignServiceCount === 0) {
          await tx.profileService.deleteMany({
            where: { socialAccountId: existingAccount.id },
          });
          await tx.socialAccount.delete({
            where: { id: existingAccount.id },
          });
        }
      }
    }

    // Mismo tratamiento que al crear: el identificador se guarda limpio
    // aunque llegue como URL.
    const cuentasNormalizadas = await normalizarCuentas(data.socialAccounts);

    for (const sa of cuentasNormalizadas) {
      const existingAccount = existingAccounts.find(
        (acc) => acc.platformId === sa.platformId
      );

      let socialAccountId: string;

      if (existingAccount) {
        await tx.socialAccount.update({
          where: { id: existingAccount.id },
          data: { username: sa.username },
        });
        socialAccountId = existingAccount.id;

        const newServiceTypeIds = new Set(sa.services.map((s) => s.serviceTypeId));

        for (const existingService of existingAccount.services) {
          if (!newServiceTypeIds.has(existingService.serviceTypeId)) {
            const campaignServiceCount = await tx.campaignService.count({
              where: { profileServiceId: existingService.id },
            });

            if (campaignServiceCount === 0) {
              await tx.profileService.delete({
                where: { id: existingService.id },
              });
            }
          }
        }
      } else {
        const newAccount = await tx.socialAccount.create({
          data: {
            profileId: id,
            platformId: sa.platformId,
            username: sa.username,
          },
        });
        socialAccountId = newAccount.id;
      }

      for (const service of sa.services) {
        await tx.profileService.upsert({
          where: {
            socialAccountId_serviceTypeId: {
              socialAccountId,
              serviceTypeId: service.serviceTypeId,
            },
          },
          update: {
            price: service.price,
            currency: service.currency || "COP",
          },
          create: {
            socialAccountId,
            serviceTypeId: service.serviceTypeId,
            price: service.price,
            currency: service.currency || "COP",
          },
        });
      }
    }

    return tx.profile.findUnique({
      where: { id },
      include: PROFILE_API_INCLUDE,
    });
  });

  revalidateTag("profiles", "hours");
  return profile;
}

export async function deleteProfile(id: string) {
  const profile = await prisma.profile.findUnique({ where: { id } });

  if (!profile) {
    throw new NotFoundError("Perfil no encontrado");
  }

  await prisma.profile.delete({ where: { id } });
  revalidateTag("profiles", "hours");
}

// --- Sync helpers ---

export async function getProfileWithSocialAccounts(id: string) {
  const profile = await prisma.profile.findUnique({
    where: { id },
    include: {
      socialAccounts: {
        include: { platform: true },
      },
    },
  });

  if (!profile) {
    throw new NotFoundError("Perfil no encontrado");
  }

  return profile;
}

export async function updateSocialAccountMetrics(
  accountId: string,
  metrics: {
    fullName?: string | null;
    biography?: string | null;
    verified?: boolean;
    profilePicUrl?: string | null;
    followers?: number | null;
    following?: number | null;
    posts?: number | null;
    engagementRate?: number | null;
    avgLikes?: number | null;
    avgViews?: number | null;
    /** YouTube trae la URL del canal; Instagram y TikTok no la envian. */
    profileUrl?: string | null;
  }
) {
  await prisma.socialAccount.update({
    where: { id: accountId },
    data: {
      ...metrics,
      lastSyncAt: new Date(),
    },
  });
}

export async function refetchProfile(id: string) {
  return prisma.profile.findUnique({
    where: { id },
    include: PROFILE_API_INCLUDE,
  });
}
