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

/**
 * Clave con la que se reconoce un formato dentro de una plataforma.
 *
 * El combo no sale del tarifario y no tiene profileServiceId, asi que
 * ocupa una clave propia. Hay como mucho uno por plataforma.
 */
const COMBO = "__combo__";
const claveDeFormato = (s: {
  esCombo?: boolean | null;
  profileServiceId?: string | null;
}) => (s.esCombo ? COMBO : s.profileServiceId ?? COMBO);

/** Lo que hace falta saber de cada influencer ya guardado. */
const SELECCION_ACTUAL = {
  id: true,
  profileId: true,
  status: true,
  rejectionReason: true,
  participacion: true,
  profile: { select: { name: true } },
  platforms: {
    select: {
      id: true,
      socialAccountId: true,
      services: {
        select: {
          id: true,
          esCombo: true,
          profileServiceId: true,
          _count: { select: { entregas: true } },
          profileService: {
            select: { serviceType: { select: { displayName: true } } },
          },
        },
      },
    },
  },
} as const;

/**
 * Guarda la linea de influencers de una campana.
 *
 * **Es incremental a proposito.** Antes borraba y volvia a crear todas
 * las plataformas y formatos de cada influencer en cada guardado, y eso
 * se llevaba por delante, en cascada, todo lo que cuelga de un formato:
 * las entregas registradas, sus metricas, la fecha limite, las notas
 * del cliente y cualquier precio renegociado. Con la campana Abierta no
 * existe nada de eso todavia y el atajo no se notaba; en cuanto el
 * editor se abrio a campanas enviadas o en marcha, guardar sin tocar
 * nada habria borrado el trabajo ya publicado.
 *
 * Ahora cada fila se reconoce y se actualiza: la plataforma por su
 * cuenta social, el formato por su tarifa de origen. Lo que desaparece
 * de la seleccion se borra solo si no tiene nada publicado; si lo
 * tiene, el guardado se rechaza nombrandolo, porque esa no es una
 * decision que deba tomarse sin enterarse.
 */
export async function setCampaignProfiles(
  campaignId: string,
  profiles: ProfileInput[]
) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { status: true },
  });

  if (!campaign) {
    throw new NotFoundError("Campaña no encontrada");
  }

  /**
   * Una campana "empezada" es la que el cliente ya vio.
   *
   * A partir de ahi los precios dejan de refrescarse desde el tarifario:
   * el cliente aprobo un importe concreto, y que suba solo porque el
   * influencer cambio su tarifa seria cambiarle el trato por detras.
   * Repreciar sigue siendo posible por la via acotada y auditada de
   * cambiarPrecioDeFormato().
   */
  const empezada = campaign.status !== "DRAFT" && campaign.status !== "PENDING";

  const entrantes = profiles ?? [];
  const profileIds = entrantes.map((p) => p.profileId);

  if (profileIds.length > 0) {
    const existen = await prisma.profile.findMany({
      where: { id: { in: profileIds } },
      select: { id: true },
    });

    if (existen.length !== profileIds.length) {
      throw new ValidationError("Algunos perfiles no existen");
    }
  }

  // Los combos no tienen tarifa que consultar: su precio se escribe al
  // armar la campana, asi que se excluyen de esta busqueda.
  const idsDeTarifas = entrantes.flatMap((p) =>
    p.platforms.flatMap((pl) =>
      pl.services
        .filter((s) => !s.esCombo && s.profileServiceId)
        .map((s) => s.profileServiceId!)
    )
  );

  const tarifas = await prisma.profileService.findMany({
    where: { id: { in: idsDeTarifas } },
  });

  const tarifaPorId = new Map(tarifas.map((ps) => [ps.id, ps]));

  for (const id of idsDeTarifas) {
    if (!tarifaPorId.has(id)) {
      throw new ValidationError(`Formato no encontrado: ${id}`);
    }
  }

  return prisma.$transaction(async (tx) => {
    const actuales = await tx.campaignProfile.findMany({
      where: { campaignId },
      select: SELECCION_ACTUAL,
    });

    /**
     * Una campana que el cliente ya vio no se queda sin nadie.
     *
     * Llegar aqui con la lista vacia teniendo gente dentro no es una
     * decision de nadie: es una pantalla que se rompio. Paso en
     * produccion. El editor perdia la configuracion de formatos, armaba
     * el envio filtrando las redes marcadas, no quedaba ninguna, y
     * mandaba `profiles: []`. Desde aqui eso era indistinguible de
     * "quitalos a todos", asi que una campana En proceso retiro a su
     * reparto entero y una en Revision lo perdio —sin aprobar y sin
     * entregas, la regla de abajo borra— sin que nadie lo pidiera.
     *
     * En DRAFT vaciar es legitimo y no cuesta nada: debajo no hay ni una
     * aprobacion ni una entrega. A partir de REVIEW no lo es, por la
     * misma razon por la que transitionCampaignStatus no deja SALIR de
     * DRAFT vacia: una campana que el cliente esta revisando, o que ya
     * esta en marcha, sin un solo creador no describe nada real.
     *
     * Se comprueba dentro de la transaccion y contra lo que hay de
     * verdad en la base, no contra lo que diga el cliente.
     */
    const activos = actuales.filter((cp) => cp.participacion !== "RETIRADO");

    if (empezada && entrantes.length === 0 && activos.length > 0) {
      throw new ValidationError(
        `No se guardó nada: la campaña tiene ${activos.length} ` +
          `${activos.length === 1 ? "creador" : "creadores"} y la petición llegó sin ninguno. ` +
          "Si el editor mostraba «Total Formatos $0», recárgalo antes de volver a guardar. " +
          "Para sacar a alguien, quítalo con su papelera; si se cae la campaña entera, cancélala."
      );
    }

    // -----------------------------------------------------------------
    // Los que salen de la seleccion
    // -----------------------------------------------------------------
    const quedan = new Set(profileIds);

    for (const cp of actuales) {
      if (quedan.has(cp.profileId)) continue;
      if (cp.participacion === "RETIRADO") continue;

      const publicado = cp.platforms.some((pl) =>
        pl.services.some((s) => s._count.entregas > 0)
      );

      /**
       * A quien el cliente rechazo NO se le borra: se le retira.
       *
       * Su fila es el historial del rechazo —quien fue y por que— y hay
       * que conservarla, pero tampoco puede seguir sumando en el total
       * de la campana. Retirarlo resuelve las dos cosas a la vez.
       */
      if (cp.status === "REJECTED") {
        await tx.campaignProfile.update({
          where: { id: cp.id },
          data: {
            participacion: "RETIRADO",
            origenRetiro: "CLIENTE",
            motivoRetiro: cp.rejectionReason,
            retiradoEn: new Date(),
          },
        });
        continue;
      }

      /**
       * Al que el cliente aprobo, o al que ya publico algo, tampoco.
       * Eso es trabajo contratado y, en el segundo caso, contenido que
       * existe ahi fuera con sus metricas detras. Se retira, que es la
       * operacion que la aplicacion ya tiene para esto y la que deja
       * libre el presupuesto sin perder la historia.
       */
      if (publicado || cp.status === "APPROVED") {
        await tx.campaignProfile.update({
          where: { id: cp.id },
          data: {
            participacion: "RETIRADO",
            origenRetiro: "AGENCIA",
            motivoRetiro: "Retirado al editar la campaña",
            retiradoEn: new Date(),
          },
        });
        continue;
      }

      // Nadie lo aprobo y no publico nada: no hay nada que recordar.
      await tx.campaignProfile.delete({ where: { id: cp.id } });
    }

    // -----------------------------------------------------------------
    // Los que entran o siguen
    // -----------------------------------------------------------------
    const resultado: { id: string; profileId: string }[] = [];

    for (const entrada of entrantes) {
      const previo = actuales.find((c) => c.profileId === entrada.profileId);

      const campaignProfile =
        previo ??
        (await tx.campaignProfile.create({
          data: { campaignId, profileId: entrada.profileId },
          select: SELECCION_ACTUAL,
        }));

      // Volver a elegir a alguien retirado lo devuelve a la campana, que
      // es lo mismo que hace el boton "Devolver a la campana" de su
      // ficha. Sin esto seguiria sin contar aunque apareciera elegido.
      if (previo?.participacion === "RETIRADO") {
        await tx.campaignProfile.update({
          where: { id: previo.id },
          data: {
            participacion: "ACTIVO",
            origenRetiro: null,
            motivoRetiro: null,
            retiradoEn: null,
          },
        });
      }

      const cuentasEntrantes = new Set(
        entrada.platforms.map((pl) => pl.socialAccountId)
      );

      // --- redes que salen ---
      for (const pl of campaignProfile.platforms) {
        if (cuentasEntrantes.has(pl.socialAccountId)) continue;

        if (pl.services.some((s) => s._count.entregas > 0)) {
          throw new ValidationError(
            `No se puede quitar esa red de ${campaignProfile.profile.name}: ya tiene contenido publicado. Retíralo de la campaña si ya no participa.`
          );
        }
        await tx.campaignProfilePlatform.delete({ where: { id: pl.id } });
      }

      // --- redes que entran o siguen ---
      for (const platformInput of entrada.platforms) {
        const plPrevia = campaignProfile.platforms.find(
          (pl) => pl.socialAccountId === platformInput.socialAccountId
        );

        const plataformaId =
          plPrevia?.id ??
          (
            await tx.campaignProfilePlatform.create({
              data: {
                campaignProfileId: campaignProfile.id,
                socialAccountId: platformInput.socialAccountId,
              },
              select: { id: true },
            })
          ).id;

        const previos = plPrevia?.services ?? [];
        const clavesEntrantes = new Set(
          platformInput.services.map(claveDeFormato)
        );

        // --- formatos que salen ---
        for (const sv of previos) {
          if (clavesEntrantes.has(claveDeFormato(sv))) continue;

          if (sv._count.entregas > 0) {
            const nombre =
              sv.profileService?.serviceType.displayName ?? "ese formato";
            throw new ValidationError(
              `No se puede quitar ${nombre} de ${campaignProfile.profile.name}: ya tiene contenido publicado.`
            );
          }
          await tx.campaignService.delete({ where: { id: sv.id } });
        }

        // --- formatos que entran o siguen ---
        for (const serviceInput of platformInput.services) {
          const svPrevio = previos.find(
            (sv) => claveDeFormato(sv) === claveDeFormato(serviceInput)
          );

          if (serviceInput.esCombo) {
            // El precio viene del formulario, no del tarifario, y la
            // cantidad es siempre 1: un combo es un acuerdo cerrado.
            if (svPrevio) {
              await tx.campaignService.update({
                where: { id: svPrevio.id },
                data: {
                  esCombo: true,
                  comboDescripcion: serviceInput.comboDescripcion?.trim() || null,
                  quantity: 1,
                  ...(empezada
                    ? {}
                    : { basePrice: serviceInput.comboPrecio ?? 0 }),
                },
              });
            } else {
              await tx.campaignService.create({
                data: {
                  campaignProfilePlatformId: plataformaId,
                  profileServiceId: null,
                  esCombo: true,
                  comboDescripcion: serviceInput.comboDescripcion?.trim() || null,
                  quantity: 1,
                  basePrice: serviceInput.comboPrecio ?? 0,
                  currency: "COP",
                },
              });
            }
            continue;
          }

          const tarifa = tarifaPorId.get(serviceInput.profileServiceId!)!;

          if (svPrevio) {
            await tx.campaignService.update({
              where: { id: svPrevio.id },
              data: {
                quantity: serviceInput.quantity,
                // El precio solo se refresca mientras sigue Abierta.
                ...(empezada
                  ? {}
                  : { basePrice: tarifa.price, currency: tarifa.currency }),
              },
            });
          } else {
            await tx.campaignService.create({
              data: {
                campaignProfilePlatformId: plataformaId,
                profileServiceId: serviceInput.profileServiceId,
                quantity: serviceInput.quantity,
                basePrice: tarifa.price,
                currency: tarifa.currency,
              },
            });
          }
        }
      }

      resultado.push({
        id: campaignProfile.id,
        profileId: campaignProfile.profileId,
      });
    }

    return resultado;
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
