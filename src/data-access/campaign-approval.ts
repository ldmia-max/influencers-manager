import { prisma } from "@/lib/prisma";
import { CampaignProfileStatus } from "@prisma/client";
import { ValidationError, NotFoundError } from "./errors";
import {
  CODIGO_MINUTOS,
  MAX_INTENTOS,
  REENVIO_SEGUNDOS,
  codigoCoincide,
  generarCodigo,
  hashearCodigo,
  normalizarCorreo,
} from "@/lib/approval-session";

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

// =====================================================================
// Verificacion de acceso al portal de aprobacion
// =====================================================================

/**
 * Comprueba el token y devuelve a quien va dirigido, sin exponer datos
 * de la campana. Se usa antes de verificar el correo, cuando todavia no
 * hay sesion: solo dice si el enlace sirve y da el nombre del contacto
 * y una pista del correo, nunca la direccion completa.
 */
export async function estadoDelToken(token: string) {
  const registro = await prisma.campaignApprovalToken.findUnique({
    where: { token },
    include: { campaign: { select: { name: true, status: true } } },
  });

  if (!registro) throw new NotFoundError("Token no encontrado");
  if (registro.usedAt) throw new ValidationError("USED_TOKEN");
  if (registro.expiresAt < new Date()) throw new ValidationError("EXPIRED_TOKEN");
  if (registro.campaign.status !== "REVIEW") {
    throw new ValidationError("INVALID_STATUS");
  }

  return {
    campaignName: registro.campaign.name,
    sentToName: registro.sentToName,
    // Pista del tipo "ma***@empresa.com": suficiente para que el
    // destinatario legitimo se reconozca, inutil para adivinarla.
    pistaCorreo: enmascararCorreo(registro.sentToEmail),
  };
}

function enmascararCorreo(correo: string): string {
  const [usuario, dominio] = correo.split("@");
  if (!dominio) return "***";
  const visible = usuario.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(usuario.length - 2, 1))}@${dominio}`;
}

/**
 * Guarda el codigo (hasheado) para un token, si el correo coincide.
 *
 * Devuelve el codigo en claro SOLO para poder enviarlo por correo; no
 * debe salir nunca en la respuesta HTTP. Si el correo no coincide
 * devuelve null y quien llama responde igual que si coincidiera, para
 * no revelar a que direccion se envio la campana.
 */
export async function prepararCodigo(token: string, correo: string) {
  const registro = await prisma.campaignApprovalToken.findUnique({
    where: { token },
    include: { campaign: { select: { name: true, status: true } } },
  });

  if (!registro) throw new NotFoundError("Token no encontrado");
  if (registro.usedAt) throw new ValidationError("USED_TOKEN");
  if (registro.expiresAt < new Date()) throw new ValidationError("EXPIRED_TOKEN");
  if (registro.campaign.status !== "REVIEW") {
    throw new ValidationError("INVALID_STATUS");
  }

  if (normalizarCorreo(registro.sentToEmail) !== normalizarCorreo(correo)) {
    return null;
  }

  // Freno de reenvio: evita que el formulario sirva para bombardear de
  // correos a un destinatario real.
  if (
    registro.codeSentAt &&
    Date.now() - registro.codeSentAt.getTime() < REENVIO_SEGUNDOS * 1000
  ) {
    throw new ValidationError("REENVIO_DEMASIADO_PRONTO");
  }

  const codigo = generarCodigo();

  await prisma.campaignApprovalToken.update({
    where: { id: registro.id },
    data: {
      codeHash: hashearCodigo(codigo),
      codeExpiresAt: new Date(Date.now() + CODIGO_MINUTOS * 60 * 1000),
      codeSentAt: new Date(),
      codeAttempts: 0,
    },
  });

  return {
    codigo,
    destino: registro.sentToEmail,
    nombre: registro.sentToName,
    campaignName: registro.campaign.name,
  };
}

/**
 * Valida el codigo. Devuelve el correo verificado si es correcto.
 *
 * Cada intento fallido cuenta; al llegar a MAX_INTENTOS el codigo se
 * borra y hay que pedir otro. Sin ese limite, seis digitos se agotan
 * por fuerza bruta en minutos.
 */
export async function validarCodigo(token: string, codigo: string) {
  const registro = await prisma.campaignApprovalToken.findUnique({
    where: { token },
  });

  if (!registro) throw new NotFoundError("Token no encontrado");
  if (registro.usedAt) throw new ValidationError("USED_TOKEN");
  if (registro.expiresAt < new Date()) throw new ValidationError("EXPIRED_TOKEN");

  if (!registro.codeHash || !registro.codeExpiresAt) {
    throw new ValidationError("SIN_CODIGO");
  }
  if (registro.codeExpiresAt < new Date()) {
    throw new ValidationError("CODIGO_EXPIRADO");
  }
  if (registro.codeAttempts >= MAX_INTENTOS) {
    throw new ValidationError("DEMASIADOS_INTENTOS");
  }

  if (!codigoCoincide(codigo, registro.codeHash)) {
    await prisma.campaignApprovalToken.update({
      where: { id: registro.id },
      data: { codeAttempts: { increment: 1 } },
    });
    throw new ValidationError("CODIGO_INCORRECTO");
  }

  // Correcto: se consume el codigo y se deja la traza de quien entro.
  await prisma.campaignApprovalToken.update({
    where: { id: registro.id },
    data: {
      codeHash: null,
      codeExpiresAt: null,
      codeAttempts: 0,
      verifiedAt: new Date(),
      verifiedEmail: registro.sentToEmail,
    },
  });

  return { email: registro.sentToEmail };
}
