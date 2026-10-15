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


// =============================================================================
// Reemplazos en una campana ya activa
// =============================================================================

/**
 * Suma un influencer a una campana YA EN MARCHA.
 *
 * Existe porque un influencer puede retirarse a mitad de campana, y hasta
 * ahora la unica salida era cancelarla y rehacerla: eso congela la
 * campana para siempre, deja las entregas ya publicadas colgando de un
 * registro cancelado y obliga al cliente a reaprobar a todos los demas.
 *
 * A proposito NO reutiliza setCampaignProfiles, que reemplaza la lista
 * entera. Aqui solo se anade: nada de lo ya aprobado se toca, y nadie que
 * haya entregado contenido puede desaparecer por un descuido.
 *
 * Entra como PENDING porque es una decision comercial nueva —otro
 * creador, otra audiencia, otro precio— y le corresponde al cliente
 * verla. Quien tenga delegada esa decision puede aprobarlo en el acto con
 * aprobarInfluencerDeCampana().
 */
export async function agregarInfluencerACampana(
  campaignId: string,
  entrada: ProfileInput
) {
  const campana = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, name: true, status: true },
  });
  if (!campana) throw new NotFoundError("Campaña no encontrada");

  // Abierta y En proceso. En Revision no, porque el cliente esta
  // mirando esa misma lista y le apareceria gente a mitad de decidir;
  // en Cerrada y Cancelada tampoco, que son terminales.
  const ADMITEN_NUEVOS = ["ACTIVE", "DRAFT", "PENDING"];
  if (!ADMITEN_NUEVOS.includes(campana.status)) {
    throw new ValidationError(
      "No se pueden añadir influencers a esta campaña: solo mientras está abierta o en proceso."
    );
  }

  const perfil = await prisma.profile.findUnique({
    where: { id: entrada.profileId },
    select: { id: true, name: true },
  });
  if (!perfil) throw new NotFoundError("Influencer no encontrado");

  const yaEsta = await prisma.campaignProfile.findUnique({
    where: {
      campaignId_profileId: { campaignId, profileId: entrada.profileId },
    },
    select: { id: true, participacion: true },
  });

  if (yaEsta) {
    // Un retirado no vuelve por esta puerta: para eso esta reactivar, que
    // le devuelve su configuracion anterior en lugar de duplicarla.
    throw new ValidationError(
      yaEsta.participacion === "RETIRADO"
        ? `${perfil.name} ya estuvo en esta campaña y se retiró. Reactívalo desde el bloque de entregas si vuelve.`
        : `${perfil.name} ya está en esta campaña.`
    );
  }

  if (entrada.platforms.length === 0) {
    throw new ValidationError("Selecciona al menos una plataforma");
  }

  // Precios del tarifario, para no fiarse de lo que llegue del navegador.
  const idsServicios = entrada.platforms.flatMap((pl) =>
    pl.services.filter((s) => !s.esCombo && s.profileServiceId).map((s) => s.profileServiceId!)
  );
  const tarifas = await prisma.profileService.findMany({
    where: { id: { in: idsServicios } },
  });
  const tarifaPorId = new Map(tarifas.map((t) => [t.id, t]));
  for (const id of idsServicios) {
    if (!tarifaPorId.has(id)) throw new ValidationError(`Formato no encontrado: ${id}`);
  }

  return prisma.$transaction(async (tx) => {
    const campaignProfile = await tx.campaignProfile.create({
      data: {
        campaignId,
        profileId: entrada.profileId,
        status: "PENDING",
      },
    });

    for (const plataforma of entrada.platforms) {
      const campaignPlatform = await tx.campaignProfilePlatform.create({
        data: {
          campaignProfileId: campaignProfile.id,
          socialAccountId: plataforma.socialAccountId,
          status: "PENDING",
        },
      });

      for (const servicio of plataforma.services) {
        if (servicio.esCombo) {
          await tx.campaignService.create({
            data: {
              campaignProfilePlatformId: campaignPlatform.id,
              profileServiceId: null,
              esCombo: true,
              comboDescripcion: servicio.comboDescripcion?.trim() || null,
              quantity: 1,
              basePrice: servicio.comboPrecio ?? 0,
              currency: "COP",
            },
          });
          continue;
        }

        const tarifa = tarifaPorId.get(servicio.profileServiceId!)!;
        await tx.campaignService.create({
          data: {
            campaignProfilePlatformId: campaignPlatform.id,
            profileServiceId: servicio.profileServiceId,
            quantity: servicio.quantity,
            basePrice: tarifa.price,
            currency: tarifa.currency,
          },
        });
      }
    }

    return {
      campaignProfileId: campaignProfile.id,
      influencer: perfil,
      campana,
    };
  });
}

/**
 * Aprueba un influencer sin pasar por el cliente.
 *
 * Para cuando la agencia tiene delegada esa decision. Queda auditado
 * desde la ruta: se esta aprobando en nombre del cliente un gasto que el
 * no ha visto, y meses despues hay que poder reconstruir quien lo hizo.
 */
export async function aprobarInfluencerDeCampana(campaignProfileId: string) {
  const perfil = await prisma.campaignProfile.findUnique({
    where: { id: campaignProfileId },
    select: {
      id: true,
      status: true,
      campaign: { select: { id: true, name: true } },
      profile: { select: { id: true, name: true } },
    },
  });
  if (!perfil) throw new NotFoundError("Influencer no encontrado en la campaña");

  if (perfil.status === "APPROVED") {
    throw new ValidationError("Este influencer ya estaba aprobado");
  }

  const ahora = new Date();
  await prisma.$transaction([
    prisma.campaignProfile.update({
      where: { id: campaignProfileId },
      data: { status: "APPROVED", reviewedAt: ahora, rejectionReason: null },
    }),
    prisma.campaignProfilePlatform.updateMany({
      where: { campaignProfileId },
      data: { status: "APPROVED", reviewedAt: ahora, rejectionReason: null },
    }),
  ]);

  return { id: perfil.id, campana: perfil.campaign, influencer: perfil.profile };
}

/**
 * Quita de la campana a un influencer que aun espera aprobacion.
 *
 * Aqui se BORRA de verdad, mientras que retirar a un contratado solo lo
 * marca. La diferencia es que este no llego a serlo: se anadio como
 * tentativa, el cliente no lo ha visto y no hay nada que conservar. Un
 * retiro deja fila, motivo y fecha porque documenta un acuerdo que
 * existio; esto solo ensuciaria la vista con alguien que nunca entro,
 * y por eso tampoco se pide motivo.
 *
 * Las tres condiciones son lo que separa "descartar un tanteo" de
 * "borrar historia comercial":
 *
 *  - PENDING. Si el cliente ya dijo algo —aprobado o rechazado—, su
 *    respuesta es un hecho y se conserva.
 *  - Sin entregas. Si ya hay contenido registrado, alguien publico algo
 *    en nombre de esta campana y borrarlo se llevaria por delante sus
 *    metricas por el efecto cascada.
 *  - ACTIVO. Un retirado ya tiene su propio camino y su motivo escrito.
 */
export async function descartarInfluencerPendiente(campaignProfileId: string) {
  const perfil = await prisma.campaignProfile.findUnique({
    where: { id: campaignProfileId },
    select: {
      id: true,
      status: true,
      participacion: true,
      campaign: { select: { id: true, name: true } },
      profile: { select: { id: true, name: true } },
      _count: { select: { platforms: true } },
      platforms: { select: { _count: { select: { services: true } } } },
    },
  });
  if (!perfil) throw new NotFoundError("Influencer no encontrado en la campaña");

  if (perfil.status !== "PENDING") {
    throw new ValidationError(
      perfil.status === "APPROVED"
        ? "Este influencer ya está aprobado: retíralo en vez de quitarlo, para que quede constancia."
        : "El cliente ya se pronunció sobre este influencer: su respuesta no se borra."
    );
  }

  if (perfil.participacion !== "ACTIVO") {
    throw new ValidationError("Este influencer ya fue retirado de la campaña.");
  }

  const entregas = await prisma.campaignEntrega.count({
    where: {
      campaignService: {
        campaignProfilePlatform: { campaignProfileId },
      },
    },
  });
  if (entregas > 0) {
    throw new ValidationError(
      "Ya hay contenido registrado a su nombre: retíralo en vez de quitarlo, para no perder esas entregas."
    );
  }

  // El borrado arrastra plataformas y formatos por cascada.
  await prisma.campaignProfile.delete({ where: { id: campaignProfileId } });

  return { campana: perfil.campaign, influencer: perfil.profile };
}

/** Influencers de una campana que esperan decision del cliente. */
export async function influencersPendientesDeAprobacion(campaignId: string) {
  return prisma.campaignProfile.findMany({
    where: { campaignId, status: "PENDING", participacion: "ACTIVO" },
    select: { id: true, profile: { select: { id: true, name: true } } },
  });
}

/**
 * Cambia el precio base de UN formato ya contratado.
 *
 * La campana activa no se edita a proposito: el editor dejaria cambiar
 * precios que el cliente aprobo o quitar a quien ya entrego. Pero el
 * precio de un formato concreto si se renegocia en la vida real —el
 * cliente comenta el importe, o el influencer sube su tarifa— y hasta
 * ahora la unica salida era cancelar la campana y rehacerla.
 *
 * Asi que esta es la excepcion, y es estrecha a proposito: toca un
 * unico `basePrice` y nada mas. No mueve cantidades, ni formatos, ni a
 * quien esta contratado, que es lo que hace peligroso al editor.
 *
 * Se toca la BASE, no el precio del cliente: la base es lo que cobra el
 * influencer —y lo que contabilidad le paga— y de ella sale el precio
 * del cliente aplicando el margen de la campana. Fijar el del cliente
 * dejaria la base sin definir, que es justo el numero que importa para
 * pagar.
 *
 * Devuelve lo que hacia falta para auditarlo: de cuanto a cuanto, de
 * quien, y si el cliente ya lo habia aprobado, que es la diferencia
 * entre ajustar un borrador y cambiar algo ya acordado.
 */
export async function cambiarPrecioDeFormato(
  campaignId: string,
  servicioId: string,
  nuevoPrecio: number
) {
  if (!Number.isFinite(nuevoPrecio) || nuevoPrecio <= 0) {
    throw new ValidationError("El precio debe ser un número mayor que cero");
  }

  const servicio = await prisma.campaignService.findUnique({
    where: { id: servicioId },
    select: {
      id: true,
      basePrice: true,
      quantity: true,
      esCombo: true,
      comboDescripcion: true,
      isApproved: true,
      profileService: {
        select: { serviceType: { select: { displayName: true } } },
      },
      campaignProfilePlatform: {
        select: {
          socialAccount: { select: { platform: { select: { displayName: true } } } },
          campaignProfile: {
            select: {
              status: true,
              participacion: true,
              profile: { select: { name: true } },
              campaign: {
                select: { id: true, name: true, status: true, markupPercentage: true },
              },
            },
          },
        },
      },
    },
  });

  if (!servicio) throw new NotFoundError("Formato no encontrado");

  const cp = servicio.campaignProfilePlatform.campaignProfile;

  // Que el formato sea de ESTA campana, y no de otra cuyo id alguien
  // adivino: cambiar el precio es cambiar dinero contratado.
  if (cp.campaign.id !== campaignId) {
    throw new ValidationError("Ese formato no pertenece a esta campaña");
  }

  // Una campana cerrada o cancelada es historia: lo que costo ya se
  // facturo o se dejo de hacer, y repreciarla ahora descuadraria lo que
  // contabilidad tiene por pagado.
  if (cp.campaign.status === "COMPLETED" || cp.campaign.status === "CANCELLED") {
    throw new ValidationError(
      "Esta campaña ya terminó: su precio es historia y no se puede cambiar."
    );
  }

  // A un retirado no se le renegocia nada: dejo de estar contratado y
  // su importe ya no cuenta en la campana.
  if (cp.participacion !== "ACTIVO") {
    throw new ValidationError(
      "Este influencer está retirado de la campaña: su precio ya no cuenta."
    );
  }

  const anterior = Number(servicio.basePrice);

  await prisma.campaignService.update({
    where: { id: servicioId },
    data: { basePrice: nuevoPrecio },
  });

  return {
    campana: cp.campaign,
    influencer: cp.profile.name,
    red: servicio.campaignProfilePlatform.socialAccount.platform.displayName,
    formato: servicio.esCombo
      ? `Combo${servicio.comboDescripcion ? ` (${servicio.comboDescripcion})` : ""}`
      : (servicio.profileService?.serviceType.displayName ?? "Formato"),
    cantidad: servicio.quantity,
    anterior,
    nuevo: nuevoPrecio,
    /** El cliente ya lo habia aprobado: no es ajustar un borrador. */
    yaAprobado: cp.status === "APPROVED" && servicio.isApproved,
  };
}
