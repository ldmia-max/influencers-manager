import { prisma } from "@/lib/prisma";
import { ValidationError, NotFoundError } from "@/data-access/errors";

/**
 * Convierte un brief diligenciado en una campana en estado DRAFT.
 *
 * El brief guarda la empresa y el contacto como texto libre, asi que
 * aqui se resuelven contra las tablas reales:
 *
 *   1. Se busca el Client por email (Client.email es @unique). Si no
 *      existe, se crea.
 *   2. Se busca el ClientContact por email dentro de ese cliente. Si no
 *      existe, se crea.
 *   3. Se crea la Campaign en DRAFT y se marca el brief como CONVERTIDO.
 *
 * Los perfiles y servicios NO se asignan aqui: eso se hace despues desde
 * el asistente de campanas, que es donde se calculan precios y markup.
 */
export async function convertirBriefACampana(
  briefId: string,
  createdById: string
) {
  const brief = await prisma.campaignBrief.findUnique({ where: { id: briefId } });

  if (!brief) {
    throw new NotFoundError("Brief no encontrado");
  }

  if (brief.campaignId) {
    throw new ValidationError("Este brief ya fue convertido en campaña");
  }

  const correo = brief.correo.trim().toLowerCase();

  return prisma.$transaction(async (tx) => {
    // 1. Cliente: se reutiliza si ya existe con ese correo
    let client = await tx.client.findUnique({ where: { email: correo } });

    if (!client) {
      client = await tx.client.create({
        data: {
          companyName: brief.empresa,
          email: correo,
          createdById,
        },
      });
    }

    // 2. Contacto dentro de ese cliente
    let contact = await tx.clientContact.findFirst({
      where: { clientId: client.id, email: correo },
    });

    if (!contact) {
      const partes = brief.responsable.trim().split(/\s+/);
      const firstName = partes[0] || brief.responsable;
      const lastName = partes.slice(1).join(" ") || "-";

      const esPrimero = (await tx.clientContact.count({ where: { clientId: client.id } })) === 0;

      contact = await tx.clientContact.create({
        data: {
          clientId: client.id,
          firstName,
          lastName,
          email: correo,
          phone: brief.telefono,
          position: brief.cargo,
          isPrimary: esPrimero,
        },
      });
    }

    // 3. Campana en DRAFT
    const campaign = await tx.campaign.create({
      data: {
        name: brief.nombreCampana,
        description: brief.descripcionProducto,
        budget: brief.presupuestoTotal,
        currency: brief.moneda,
        startDate: brief.fechaInicio,
        endDate: brief.fechaFinal,
        clientId: client.id,
        clientContactId: contact.id,
        createdById,
      },
      select: { id: true, name: true },
    });

    await tx.campaignBrief.update({
      where: { id: brief.id },
      data: { status: "CONVERTIDO", campaignId: campaign.id },
    });

    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      clientId: client.id,
      clienteCreado: !client.createdAt || client.createdAt.getTime() > Date.now() - 5000,
    };
  });
}

export async function cambiarEstadoBrief(
  briefId: string,
  status: "PENDIENTE" | "REVISADO" | "DESCARTADO"
) {
  const brief = await prisma.campaignBrief.findUnique({ where: { id: briefId } });
  if (!brief) throw new NotFoundError("Brief no encontrado");
  if (brief.status === "CONVERTIDO") {
    throw new ValidationError("Un brief ya convertido no cambia de estado");
  }

  return prisma.campaignBrief.update({
    where: { id: briefId },
    data: { status },
    select: { id: true, status: true },
  });
}
