import { prisma } from "@/lib/prisma";
import { CampaignStatus } from "@prisma/client";
import { randomBytes } from "crypto";
import { ValidationError, NotFoundError } from "./errors";
import { entregasPendientesDeCampana } from "./entregas";
import { calcularTotalCampana, MARKUP_PERCENTAGE } from "@/lib/campaign-utils";

function generateApprovalToken(): string {
  return randomBytes(24).toString("base64url");
}

const VALID_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ["REVIEW", "ACTIVE", "CANCELLED"],
  REVIEW: ["PENDING", "ACTIVE", "DRAFT"],
  PENDING: ["REVIEW", "CANCELLED"],
  ACTIVE: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

function getStatusMessage(status: CampaignStatus): string {
  const messages: Record<CampaignStatus, string> = {
    DRAFT: "Campaña movida a borrador",
    REVIEW: "Campaña enviada a revisión del cliente",
    PENDING: "Campaña pendiente de ajustes",
    ACTIVE: "Campaña activada exitosamente",
    COMPLETED: "Campaña marcada como completada",
    CANCELLED: "Campaña cancelada",
  };
  return messages[status];
}

// --- API Queries ---

export async function getCampaignsPaginated(params: {
  userId: string;
  /**
   * Si el usuario ve todas o solo las suyas. Lo decide la tabla de
   * permisos (exigePropiedadParaLeer), no el rol: antes se llamaba
   * isAdmin y ataba el alcance a ser administrador, asi que ampliar la
   * visibilidad obligaba a tocar cada consulta.
   */
  verTodas: boolean;
  search?: string;
  clientId?: string;
  status?: CampaignStatus;
  page: number;
  pageSize: number;
}) {
  const skip = (params.page - 1) * params.pageSize;

  const where = {
    AND: [
      !params.verTodas ? { createdById: params.userId } : {},
      params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" as const } },
              { client: { companyName: { contains: params.search, mode: "insensitive" as const } } },
            ],
          }
        : {},
      params.clientId ? { clientId: params.clientId } : {},
      params.status ? { status: params.status } : {},
    ],
  };

  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: params.pageSize,
      include: {
        client: { select: { id: true, companyName: true } },
        clientContact: { select: { id: true, firstName: true, lastName: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        profiles: {
          select: {
            id: true,
            participacion: true,
            profile: { select: { id: true, name: true } },
            platforms: {
              select: {
                services: { select: { basePrice: true, quantity: true } },
              },
            },
          },
        },
      },
    }),
    prisma.campaign.count({ where }),
  ]);

  // El total lo calcula calcularTotalCampana y no un reduce local: es la
  // unica que sabe que los retirados no suman, y esa regla tiene que ser
  // la misma aqui, en la ficha y en el portal del cliente.
  const campaignsWithTotals = campaigns.map((campaign) => {
    const totales = calcularTotalCampana(campaign.profiles, campaign.markupPercentage);
    return {
      ...campaign,
      totalBase: totales.base,
      totalWithMarkup: totales.conMargen,
      presupuestoLiberado: totales.liberado,
      profileCount: totales.perfilesActivos,
      perfilesRetirados: totales.perfilesRetirados,
    };
  });

  return {
    campaigns: campaignsWithTotals,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.ceil(total / params.pageSize),
  };
}

export async function getCampaignById(id: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, companyName: true, email: true } },
      clientContact: {
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, position: true },
      },
      createdBy: { select: { id: true, name: true } },
      profiles: {
        include: {
          profile: { select: { id: true, name: true, type: true, country: true, city: true } },
          platforms: {
            include: {
              socialAccount: { include: { platform: true } },
              services: {
                include: { profileService: { include: { serviceType: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!campaign) {
    throw new NotFoundError("Campaña no encontrada");
  }

  return campaign;
}

// --- Page Queries ---

export async function getCampaignsForPage(params: {
  userId?: string;
  /** Ver todas o solo las propias. Lo decide la tabla de permisos. */
  verTodas: boolean;
  search?: string;
  clientId?: string;
  status?: CampaignStatus;
  page: number;
  pageSize: number;
}) {
  const skip = (params.page - 1) * params.pageSize;

  const where = {
    AND: [
      !params.verTodas ? { createdById: params.userId } : {},
      params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" as const } },
              { client: { companyName: { contains: params.search, mode: "insensitive" as const } } },
            ],
          }
        : {},
      params.clientId ? { clientId: params.clientId } : {},
      params.status ? { status: params.status } : {},
    ],
  };

  const [campaigns, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: params.pageSize,
      include: {
        client: { select: { id: true, companyName: true } },
        clientContact: { select: { id: true, firstName: true, lastName: true } },
        profiles: {
          include: {
            platforms: {
              include: {
                socialAccount: { select: { followers: true } },
                services: true,
              },
            },
          },
        },
      },
    }),
    prisma.campaign.count({ where }),
  ]);

  return { campaigns, total, totalPages: Math.ceil(total / params.pageSize) };
}

export async function getCampaignDetail(id: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, companyName: true, email: true } },
      clientContact: {
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, position: true },
      },
      createdBy: { select: { id: true, name: true } },
      approvalTokens: {
        select: {
          id: true,
          token: true,
          expiresAt: true,
          usedAt: true,
          createdAt: true,
          sentToEmail: true,
          sentToName: true,
        },
        orderBy: { createdAt: "desc" },
      },
      profiles: {
        include: {
          profile: {
            select: {
              id: true,
              name: true,
              type: true,
              gender: { select: { displayName: true } },
              department: { select: { name: true } },
            },
          },
          platforms: {
            include: {
              socialAccount: {
                select: {
                  id: true,
                  username: true,
                  followers: true,
                  platform: true,
                },
              },
              services: {
                include: {
                  profileService: { include: { serviceType: true } },
                  // Los links entregados y su ultima captura de metricas:
                  // la ficha los pinta junto a cada formato.
                  entregas: {
                    orderBy: { entregadoEn: "asc" },
                    include: {
                      registradoPor: { select: { id: true, name: true } },
                      metricas: {
                        orderBy: { capturadoEn: "desc" },
                        take: 1,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!campaign) {
    throw new NotFoundError("Campaña no encontrada");
  }

  return campaign;
}

export async function getCampaignForEdit(id: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, companyName: true } },
      clientContact: { select: { id: true, firstName: true, lastName: true } },
      profiles: {
        include: {
          profile: { select: { id: true, name: true } },
          platforms: {
            include: {
              socialAccount: { select: { id: true } },
              services: {
                select: { id: true, quantity: true, basePrice: true, profileServiceId: true },
              },
            },
          },
        },
      },
    },
  });

  if (!campaign) {
    throw new NotFoundError("Campaña no encontrada");
  }

  return campaign;
}

export async function getDashboardCampaigns(userId: string, verTodas: boolean) {
  const [activeCampaigns, draftCampaigns] = await Promise.all([
    prisma.campaign.findMany({
      where: { status: "ACTIVE", ...(verTodas ? {} : { createdById: userId }) },
      orderBy: { updatedAt: "desc" },
      include: {
        client: { select: { companyName: true } },
        _count: { select: { profiles: true } },
      },
    }),
    prisma.campaign.findMany({
      where: { status: "DRAFT", ...(verTodas ? {} : { createdById: userId }) },
      orderBy: { updatedAt: "desc" },
      include: {
        client: { select: { companyName: true } },
        _count: { select: { profiles: true } },
      },
    }),
  ]);

  return { activeCampaigns, draftCampaigns };
}

// --- Mutations ---

export async function createCampaign(data: {
  name: string;
  description?: string;
  clientId: string;
  clientContactId: string;
  budget: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  createdById: string;
}) {
  if (data.budget <= 0) {
    throw new ValidationError("El presupuesto debe ser mayor a 0");
  }

  const client = await prisma.client.findUnique({
    where: { id: data.clientId },
    include: { contacts: true },
  });

  if (!client) {
    throw new NotFoundError("Cliente no encontrado");
  }

  const contactBelongsToClient = client.contacts.some((c) => c.id === data.clientContactId);
  if (!contactBelongsToClient) {
    throw new ValidationError("El contacto no pertenece al cliente seleccionado");
  }

  return prisma.campaign.create({
    data: {
      name: data.name,
      description: data.description,
      clientId: data.clientId,
      clientContactId: data.clientContactId,
      budget: data.budget,
      currency: data.currency || "COP",
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      createdById: data.createdById,
      // Congela el margen vigente. A partir de aqui esta campana ya no
      // depende de la constante global: subirla el ano que viene no le
      // cambiara los precios.
      markupPercentage: MARKUP_PERCENTAGE,
    },
    include: {
      client: { select: { id: true, companyName: true } },
      clientContact: { select: { id: true, firstName: true, lastName: true, email: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
}

export async function updateCampaign(
  id: string,
  data: {
    name?: string;
    description?: string;
    clientId?: string;
    clientContactId?: string;
    budget?: number;
    currency?: string;
    startDate?: string | null;
    endDate?: string | null;
    status?: CampaignStatus;
  }
) {
  const existing = await prisma.campaign.findUnique({ where: { id } });

  if (!existing) {
    throw new NotFoundError("Campaña no encontrada");
  }

  if (existing.status !== "DRAFT" && existing.status !== "PENDING") {
    throw new ValidationError("Solo se pueden editar campañas en estado borrador o pendiente");
  }

  if (data.clientId && data.clientContactId) {
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
      include: { contacts: true },
    });

    if (!client) {
      throw new NotFoundError("Cliente no encontrado");
    }

    const contactBelongsToClient = client.contacts.some((c) => c.id === data.clientContactId);
    if (!contactBelongsToClient) {
      throw new ValidationError("El contacto no pertenece al cliente seleccionado");
    }
  }

  return prisma.campaign.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.clientId && { clientId: data.clientId }),
      ...(data.clientContactId && { clientContactId: data.clientContactId }),
      ...(data.budget !== undefined && { budget: data.budget }),
      ...(data.currency && { currency: data.currency }),
      ...(data.startDate !== undefined && {
        startDate: data.startDate ? new Date(data.startDate) : null,
      }),
      ...(data.endDate !== undefined && {
        endDate: data.endDate ? new Date(data.endDate) : null,
      }),
      ...(data.status && { status: data.status }),
    },
    include: {
      client: { select: { id: true, companyName: true } },
      clientContact: { select: { id: true, firstName: true, lastName: true, email: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
}


// --- Status Machine ---

export async function transitionCampaignStatus(
  campaignId: string,
  newStatus: CampaignStatus,
  reason?: string
) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      client: { select: { companyName: true } },
      clientContact: { select: { firstName: true, lastName: true, email: true } },
      profiles: {
        select: {
          id: true,
          status: true,
          platforms: { select: { id: true } },
        },
      },
    },
  });

  if (!campaign) {
    throw new NotFoundError("Campaña no encontrada");
  }

  const validTransitions = VALID_TRANSITIONS[campaign.status];
  if (!validTransitions.includes(newStatus)) {
    throw new ValidationError(
      `No se puede cambiar de ${campaign.status} a ${newStatus}`
    );
  }

  let approvalToken: string | null = null;

  // REVIEW transition: reset statuses + generate token
  if (newStatus === "REVIEW") {
    if (campaign.profiles.length === 0) {
      throw new ValidationError(
        "La campaña debe tener al menos un perfil para enviar a revisión"
      );
    }

    await prisma.campaignProfile.updateMany({
      where: { campaignId },
      data: { status: "PENDING", rejectionReason: null, reviewedAt: null },
    });

    const platformIds = campaign.profiles.flatMap((p) => p.platforms.map((pl) => pl.id));
    if (platformIds.length > 0) {
      await prisma.campaignProfilePlatform.updateMany({
        where: { id: { in: platformIds } },
        data: { status: "PENDING", rejectionReason: null, reviewedAt: null },
      });
    }

    await prisma.campaignService.updateMany({
      where: {
        campaignProfilePlatform: {
          campaignProfile: { campaignId },
        },
      },
      data: { isApproved: true, rejectionReason: null, reviewedAt: null },
    });

    approvalToken = generateApprovalToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.campaignApprovalToken.create({
      data: {
        token: approvalToken,
        expiresAt,
        campaignId,
        sentToEmail: campaign.clientContact.email,
        sentToName: `${campaign.clientContact.firstName} ${campaign.clientContact.lastName}`,
      },
    });
  }

  // ACTIVE transition: validate approvals
  if (newStatus === "ACTIVE") {
    if (campaign.status === "REVIEW") {
      const allApproved = campaign.profiles.every((p) => p.status === "APPROVED");
      if (!allApproved) {
        const pendingCount = campaign.profiles.filter((p) => p.status === "PENDING").length;
        const rejectedCount = campaign.profiles.filter((p) => p.status === "REJECTED").length;
        throw new ValidationError(
          JSON.stringify({
            error: "Todos los perfiles deben estar aprobados para activar la campaña",
            details: {
              total: campaign.profiles.length,
              approved: campaign.profiles.filter((p) => p.status === "APPROVED").length,
              pending: pendingCount,
              rejected: rejectedCount,
            },
          })
        );
      }
    }

    if (campaign.status === "DRAFT" && campaign.profiles.length > 0) {
      await prisma.campaignProfile.updateMany({
        where: { campaignId },
        data: { status: "APPROVED", reviewedAt: new Date() },
      });
    }
  }

  // Una campana no se cierra mientras falten links por registrar. Los
  // retirados no cuentan: ya no deben nada.
  if (newStatus === "COMPLETED") {
    const pendientes = await entregasPendientesDeCampana(campaignId);
    if (pendientes.length > 0) {
      const detalle = pendientes
        .map((p) => `${p.influencer} (${p.entregados} de ${p.esperados})`)
        .join(", ");
      throw new ValidationError(
        `No se puede completar la campaña: faltan entregas de ${detalle}.`
      );
    }
  }

  // Update campaign status
  const updateData: {
    status: CampaignStatus;
    activationReason?: string | null;
    activatedAt?: Date | null;
  } = { status: newStatus };

  if (newStatus === "ACTIVE") {
    updateData.activationReason = reason || null;
    updateData.activatedAt = new Date();
  }

  const updatedCampaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: updateData,
    include: {
      profiles: {
        select: {
          id: true,
          status: true,
          profile: { select: { id: true, name: true } },
        },
      },
    },
  });

  return {
    campaign: updatedCampaign,
    message: getStatusMessage(newStatus),
    approvalToken,
    emailData: newStatus === "REVIEW"
      ? {
          contactEmail: campaign.clientContact.email,
          contactName: `${campaign.clientContact.firstName} ${campaign.clientContact.lastName}`,
          campaignName: campaign.name,
          companyName: campaign.client.companyName,
        }
      : null,
  };
}

export async function regenerateApprovalToken(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      clientContact: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
  });

  if (!campaign) {
    throw new NotFoundError("Campaña no encontrada");
  }

  // ACTIVE tambien vale: a una campana en marcha se le puede sumar un
  // reemplazo cuando alguien se retira, y ese influencer nuevo necesita
  // que el cliente lo apruebe sin reabrir el resto de la campana.
  if (campaign.status !== "REVIEW" && campaign.status !== "ACTIVE") {
    throw new ValidationError(
      "Solo se puede generar un enlace cuando la campaña está en revisión o activa"
    );
  }

  if (campaign.status === "ACTIVE") {
    const pendientes = await prisma.campaignProfile.count({
      where: { campaignId, status: "PENDING", participacion: "ACTIVO" },
    });
    if (pendientes === 0) {
      throw new ValidationError(
        "No hay ningún influencer pendiente de aprobación en esta campaña"
      );
    }
  }

  const token = generateApprovalToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const newToken = await prisma.campaignApprovalToken.create({
    data: {
      token,
      expiresAt,
      campaignId,
      sentToEmail: campaign.clientContact.email,
      sentToName: `${campaign.clientContact.firstName} ${campaign.clientContact.lastName}`,
    },
  });

  return {
    token: newToken,
    approvalUrl: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/approve/${token}`,
    contactEmail: campaign.clientContact.email,
    contactName: `${campaign.clientContact.firstName} ${campaign.clientContact.lastName}`,
    campaignName: campaign.name,
    expiresAt,
  };
}

/**
 * Campanas visibles para un cliente en su portal.
 *
 * El filtro por clientId no es negociable: es lo unico que impide que
 * un cliente vea las campanas de otro. El clientId sale de la cookie
 * firmada de sesion (src/lib/client-session.ts), nunca de la peticion.
 *
 * Se excluyen los borradores: una campana en DRAFT esta a medias y el
 * cliente no deberia verla hasta que se le manda a revision.
 *
 * Devuelve el presupuesto ya formateado como cadena porque Decimal de
 * Prisma no puede cruzar a un componente de cliente.
 */
export async function getCampaignsForClientPortal(clientId: string) {
  const campaigns = await prisma.campaign.findMany({
    where: {
      clientId,
      status: { not: CampaignStatus.DRAFT },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      budget: true,
      currency: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      // Solo los que siguen contratados: al cliente no le sirve un
      // recuento que incluya a quien ya se retiro de la campana.
      _count: { select: { profiles: { where: { participacion: "ACTIVO" } } } },
    },
  });

  return campaigns.map((campaign) => ({
    ...campaign,
    budget: campaign.budget.toString(),
    totalProfiles: campaign._count.profiles,
  }));
}

/**
 * Cambia el margen de UNA campana.
 *
 * Va aparte de updateCampaign a proposito: esa funcion solo deja editar
 * campanas en DRAFT o PENDING, y aqui hace falta poder ajustar tambien
 * las ya activas o cerradas para renegociaciones. Quien puede llamarla
 * lo decide la ruta, que exige permiso de administracion.
 *
 * Cambiar el margen de una campana ya aprobada altera cifras que el
 * cliente acepto: es una decision del negocio, no un descuido, y por
 * eso esta reservada al ADMIN.
 */
export async function setCampaignMarkup(id: string, markup: number) {
  if (!Number.isFinite(markup) || markup < 0 || markup > 5) {
    throw new ValidationError(
      "El margen debe estar entre 0 y 5 (0% y 500%)"
    );
  }

  const existing = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("Campaña no encontrada");

  return prisma.campaign.update({
    where: { id },
    data: { markupPercentage: markup },
    select: { id: true, markupPercentage: true },
  });
}


/**
 * Resultados de UNA campana para el portal del cliente.
 *
 * `clientId` va en el where ademas del id de campana: ese filtro es lo
 * unico que impide que un cliente lea la campana de otro poniendo un id
 * en la barra de direcciones, y tiene que venir siempre de la cookie
 * firmada, nunca de la peticion.
 *
 * Devuelve null en vez de lanzar cuando no hay coincidencia, para que la
 * pagina responda 404 sin distinguir entre "no existe" y "no es tuya":
 * un mensaje distinto en cada caso confirmaria a un curioso que la
 * campana existe.
 *
 * Se deja fuera lo interno: los retirados no aparecen —el cliente no ve
 * ni quien decidio el retiro ni por que, y sus importes ya no cuentan—,
 * y de las entregas solo viaja el link y sus metricas, sin notas ni
 * quien las registro.
 */
export async function getCampaignResultsForClient(
  clientId: string,
  campaignId: string
) {
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      clientId,
      status: { not: CampaignStatus.DRAFT },
    },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      startDate: true,
      endDate: true,
      profiles: {
        where: { participacion: "ACTIVO" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          profile: { select: { id: true, name: true } },
          platforms: {
            select: {
              socialAccount: {
                select: {
                  username: true,
                  followers: true,
                  platform: { select: { name: true, displayName: true } },
                },
              },
              services: {
                select: {
                  id: true,
                  quantity: true,
                  esCombo: true,
                  comboDescripcion: true,
                  profileService: {
                    select: {
                      serviceType: {
                        select: { displayName: true, esEfimero: true },
                      },
                    },
                  },
                  entregas: {
                    orderBy: { entregadoEn: "asc" },
                    select: {
                      id: true,
                      url: true,
                      publicadoEn: true,
                      entregadoEn: true,
                      metricas: {
                        orderBy: { capturadoEn: "asc" },
                        select: {
                          capturadoEn: true,
                          vistas: true,
                          meGusta: true,
                          comentarios: true,
                          compartidos: true,
                          guardados: true,
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

  return campaign;
}
