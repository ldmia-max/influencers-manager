import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { exigirPermiso } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { sendMessageToAI, type ChatMessage } from "@/lib/ai";
import { calculateMarkupPrice } from "@/lib/campaign-utils";
import type Anthropic from "@anthropic-ai/sdk";

// Tipos para el estado de la campaña
interface CampaignState {
  name?: string;
  clientId?: string;
  clientContactId?: string;
  budget?: number;
  description?: string;
  startDate?: string;
  endDate?: string;
  campaignCreatedId?: string;
  selectedProfiles: {
    profileId: string;
    profileName: string;
    services: {
      serviceId: string;
      serviceName: string;
      quantity: number;
      price: number;
    }[];
  }[];
}

interface ChatRequest {
  messages: ChatMessage[];
  campaignState: CampaignState;
}

// Normalizar búsqueda de departamentos (acentos y variaciones comunes)
function normalizeDepartmentSearch(input: string): string {
  const map: Record<string, string> = {
    "bogota": "Bogotá",
    "bogotá": "Bogotá",
    "atlantico": "Atlántico",
    "atlántico": "Atlántico",
    "bolivar": "Bolívar",
    "bolívar": "Bolívar",
    "boyaca": "Boyacá",
    "boyacá": "Boyacá",
    "caqueta": "Caquetá",
    "caquetá": "Caquetá",
    "choco": "Chocó",
    "chocó": "Chocó",
    "cordoba": "Córdoba",
    "córdoba": "Córdoba",
    "guainia": "Guainía",
    "guainía": "Guainía",
    "narino": "Nariño",
    "nariño": "Nariño",
    "quindio": "Quindío",
    "quindío": "Quindío",
    "san andres": "San Andrés",
    "san andrés": "San Andrés",
    "vaupes": "Vaupés",
    "vaupés": "Vaupés",
    "valle del cauca": "Valle del Cauca",
    "valle": "Valle del Cauca",
    "antioquia": "Antioquia",
    "medellin": "Antioquia",
    "medellín": "Antioquia",
    "cesar": "Cesar",
    "magdalena": "Magdalena",
    "santander": "Santander",
    "cundinamarca": "Cundinamarca",
    "risaralda": "Risaralda",
    "tolima": "Tolima",
    "huila": "Huila",
    "meta": "Meta",
    "caldas": "Caldas",
    "cauca": "Cauca",
    "la guajira": "La Guajira",
    "guajira": "La Guajira",
    "norte de santander": "Norte de Santander",
    "sucre": "Sucre",
    "putumayo": "Putumayo",
    "casanare": "Casanare",
    "arauca": "Arauca",
    "guaviare": "Guaviare",
    "vichada": "Vichada",
    "amazonas": "Amazonas",
  };
  return map[input.toLowerCase().trim()] || input;
}

// Ejecutar tools y retornar resultados
async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  campaignState: CampaignState,
  userId: string,
  userEmail?: string
): Promise<{ result: string; updatedState?: Partial<CampaignState> }> {
  switch (toolName) {
    case "search_clients": {
      const query = toolInput.query as string;
      const clients = await prisma.client.findMany({
        where: {
          companyName: {
            contains: query,
            mode: "insensitive",
          },
        },
        include: {
          contacts: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        take: 5,
      });

      if (clients.length === 0) {
        return { result: "No se encontraron clientes con ese nombre." };
      }

      const clientList = clients.map((c) => ({
        id: c.id,
        nombre: c.companyName,
        contactos: c.contacts.map((ct) => ({
          id: ct.id,
          nombre: `${ct.firstName} ${ct.lastName}`,
          email: ct.email,
        })),
      }));

      return {
        result: JSON.stringify(clientList, null, 2),
      };
    }

    case "select_client": {
      const { clientId, clientContactId } = toolInput as {
        clientId: string;
        clientContactId: string;
      };

      // Verificar que existen en la BD
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, companyName: true },
      });
      const contact = await prisma.clientContact.findUnique({
        where: { id: clientContactId },
        select: { id: true, firstName: true, lastName: true },
      });

      if (!client) {
        return { result: `Error: Cliente con ID ${clientId} no existe. Usa search_clients para buscar de nuevo.` };
      }
      if (!contact) {
        return { result: `Error: Contacto con ID ${clientContactId} no existe. Usa search_clients para buscar de nuevo.` };
      }

      return {
        result: `Cliente seleccionado: ${client.companyName}, contacto: ${contact.firstName} ${contact.lastName}`,
        updatedState: {
          clientId: client.id,
          clientContactId: contact.id,
        },
      };
    }

    case "search_profiles": {
      const { department, country, minFollowers, maxFollowers, platforms, services, categories, limit = 10 } = toolInput as {
        department?: string;
        country?: string;
        minFollowers?: number;
        maxFollowers?: number;
        platforms?: string[];
        services?: string[];
        categories?: string[];
        limit?: number;
      };

      // Normalizar departamento para manejar acentos
      const normalizedDept = department ? normalizeDepartmentSearch(department) : undefined;

      const profiles = await prisma.profile.findMany({
        where: {
          AND: [
            normalizedDept ? { department: { name: { contains: normalizedDept, mode: "insensitive" } } } : {},
            country ? { country: { name: { contains: country, mode: "insensitive" } } } : {},
            minFollowers || maxFollowers
              ? {
                  socialAccounts: {
                    some: {
                      followers: {
                        ...(minFollowers ? { gte: minFollowers } : {}),
                        ...(maxFollowers ? { lte: maxFollowers } : {}),
                      },
                    },
                  },
                }
              : {},
            platforms && platforms.length > 0
              ? {
                  socialAccounts: {
                    some: {
                      platform: {
                        name: { in: platforms, mode: "insensitive" },
                      },
                    },
                  },
                }
              : {},
            services && services.length > 0
              ? {
                  socialAccounts: {
                    some: {
                      services: {
                        some: {
                          serviceType: {
                            name: { in: services, mode: "insensitive" },
                          },
                        },
                      },
                    },
                  },
                }
              : {},
            categories && categories.length > 0
              ? {
                  categories: {
                    some: {
                      category: {
                        name: { in: categories, mode: "insensitive" },
                      },
                    },
                  },
                }
              : {},
          ],
        },
        include: {
          country: true,
          department: true,
          city: true,
          socialAccounts: {
            // Filtrar cuentas por plataforma si se especificó
            where: platforms && platforms.length > 0
              ? { platform: { name: { in: platforms, mode: "insensitive" } } }
              : undefined,
            include: {
              platform: true,
              services: {
                include: {
                  serviceType: true,
                },
              },
            },
          },
          categories: {
            include: {
              category: true,
            },
          },
        },
        take: limit,
      });

      if (profiles.length === 0) {
        return { result: "No se encontraron perfiles con esos criterios." };
      }

      const profileList = profiles.map((p) => ({
        id: p.id,
        nombre: p.name,
        departamento: p.department?.name ?? null,
        ciudad: p.city?.name ?? null,
        pais: p.country?.name ?? null,
        cuentas: p.socialAccounts.map((sa) => ({
          plataforma: sa.platform.displayName,
          username: `@${sa.username}`,
          seguidores: sa.followers,
          servicios: sa.services.map((s) => ({
            id: s.id,
            nombre: s.serviceType.displayName,
            precio: calculateMarkupPrice(Number(s.price)),
          })),
        })),
        categorias: p.categories.map((c) => c.category.name),
      }));

      return {
        result: JSON.stringify(profileList, null, 2),
      };
    }

    case "select_profiles_auto": {
      const { count, budget, services: requiredServices, department, minFollowers } = toolInput as {
        count: number;
        budget: number;
        services?: string[];
        department?: string;
        minFollowers?: number;
      };

      const normalizedAutoDept = department ? normalizeDepartmentSearch(department) : undefined;

      const profiles = await prisma.profile.findMany({
        where: {
          AND: [
            normalizedAutoDept ? { department: { name: { contains: normalizedAutoDept, mode: "insensitive" } } } : {},
            minFollowers
              ? {
                  socialAccounts: {
                    some: {
                      followers: { gte: minFollowers },
                    },
                  },
                }
              : {},
            requiredServices && requiredServices.length > 0
              ? {
                  socialAccounts: {
                    some: {
                      services: {
                        some: {
                          serviceType: {
                            name: { in: requiredServices, mode: "insensitive" },
                          },
                        },
                      },
                    },
                  },
                }
              : {},
          ],
        },
        include: {
          socialAccounts: {
            include: {
              platform: true,
              services: {
                include: {
                  serviceType: true,
                },
              },
            },
          },
        },
        orderBy: {
          socialAccounts: {
            _count: "desc",
          },
        },
        take: count * 2, // Obtener más para seleccionar los mejores
      });

      // Seleccionar perfiles que quepan en el presupuesto
      const selected: CampaignState["selectedProfiles"] = [];
      let totalCost = 0;

      for (const profile of profiles) {
        if (selected.length >= count) break;

        // Encontrar el servicio más barato de los requeridos
        const availableServices: { serviceId: string; serviceName: string; price: number }[] = [];

        for (const sa of profile.socialAccounts) {
          for (const service of sa.services) {
            if (
              !requiredServices ||
              requiredServices.length === 0 ||
              requiredServices.some((rs) =>
                service.serviceType.name.toLowerCase().includes(rs.toLowerCase())
              )
            ) {
              const price = calculateMarkupPrice(Number(service.price));
              availableServices.push({
                serviceId: service.id,
                serviceName: service.serviceType.displayName,
                price,
              });
            }
          }
        }

        if (availableServices.length > 0) {
          // Tomar el servicio más relevante
          const service = availableServices[0];
          const serviceCost = service.price;

          if (totalCost + serviceCost <= budget) {
            selected.push({
              profileId: profile.id,
              profileName: profile.name,
              services: [
                {
                  serviceId: service.serviceId,
                  serviceName: service.serviceName,
                  quantity: 1,
                  price: service.price,
                },
              ],
            });
            totalCost += serviceCost;
          }
        }
      }

      if (selected.length === 0) {
        return { result: "No se pudieron seleccionar perfiles dentro del presupuesto." };
      }

      return {
        result: JSON.stringify({
          perfilesSeleccionados: selected.map((s) => ({
            nombre: s.profileName,
            servicios: s.services.map((sv) => `${sv.serviceName} x${sv.quantity} = $${sv.price.toLocaleString()}`),
          })),
          costoTotal: totalCost,
          presupuestoRestante: budget - totalCost,
        }, null, 2),
        updatedState: {
          selectedProfiles: [...campaignState.selectedProfiles, ...selected],
        },
      };
    }

    case "get_campaign_summary": {
      const totalCost = campaignState.selectedProfiles.reduce(
        (sum, p) => sum + p.services.reduce((s, sv) => s + sv.price * sv.quantity, 0),
        0
      );

      let clientName = "No seleccionado";
      let contactName = "No seleccionado";

      if (campaignState.clientId) {
        const client = await prisma.client.findUnique({
          where: { id: campaignState.clientId },
          include: { contacts: true },
        });
        if (client) {
          clientName = client.companyName;
          const contact = client.contacts.find((c) => c.id === campaignState.clientContactId);
          if (contact) {
            contactName = `${contact.firstName} ${contact.lastName}`;
          }
        }
      }

      return {
        result: JSON.stringify({
          nombre: campaignState.name || "Sin nombre",
          cliente: clientName,
          contacto: contactName,
          presupuesto: campaignState.budget ? `$${campaignState.budget.toLocaleString()}` : "No definido",
          perfiles: campaignState.selectedProfiles.map((p) => ({
            nombre: p.profileName,
            servicios: p.services.map((s) => `${s.serviceName} x${s.quantity}`),
            subtotal: `$${p.services.reduce((sum, s) => sum + s.price * s.quantity, 0).toLocaleString()}`,
          })),
          costoTotal: `$${totalCost.toLocaleString()}`,
          presupuestoRestante: campaignState.budget
            ? `$${(campaignState.budget - totalCost).toLocaleString()}`
            : "N/A",
        }, null, 2),
      };
    }

    case "create_campaign": {
      const { name, budget, description, startDate, endDate } = toolInput as {
        name: string;
        clientId?: string;
        clientContactId?: string;
        budget: number;
        description?: string;
        startDate?: string;
        endDate?: string;
      };

      // Usar IDs del state (confiable) con fallback a los del tool input
      const finalClientId = campaignState.clientId || (toolInput as { clientId?: string }).clientId;
      const finalContactId = campaignState.clientContactId || (toolInput as { clientContactId?: string }).clientContactId;

      // Validaciones
      if (campaignState.selectedProfiles.length === 0) {
        return { result: "Error: No hay perfiles seleccionados para la campaña." };
      }

      if (!finalClientId || !finalContactId) {
        return { result: "Error: Falta seleccionar cliente y contacto. Usa search_clients primero." };
      }

      // Verificar que los IDs existen en la BD
      // Buscar usuario por ID, si no existe buscar por email (por si la BD se recreó)
      let resolvedUserId = userId;
      let userExists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!userExists && userEmail) {
        const userByEmail = await prisma.user.findUnique({ where: { email: userEmail }, select: { id: true } });
        if (userByEmail) {
          resolvedUserId = userByEmail.id;
          userExists = userByEmail;
        }
      }

      const [clientExists, contactExists] = await Promise.all([
        prisma.client.findUnique({ where: { id: finalClientId }, select: { id: true } }),
        prisma.clientContact.findUnique({ where: { id: finalContactId }, select: { id: true } }),
      ]);

      if (!userExists) {
        return { result: "ERROR_CRITICO: El usuario no existe en la base de datos. Debe cerrar sesión y volver a iniciar sesión." };
      }
      if (!clientExists) {
        return { result: `ERROR_CRITICO: El cliente no existe (ID: ${finalClientId}). Usa search_clients para buscar de nuevo.` };
      }
      if (!contactExists) {
        return { result: `ERROR_CRITICO: El contacto no existe (ID: ${finalContactId}). Usa search_clients para buscar de nuevo.` };
      }

      try {
        // Crear la campaña
        const campaign = await prisma.campaign.create({
          data: {
            name,
            description: description || "",
            budget,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
            status: "DRAFT",
            clientId: finalClientId,
            clientContactId: finalContactId,
            createdById: resolvedUserId,
          },
        });

        // Agregar los perfiles y servicios
        for (const profile of campaignState.selectedProfiles) {
          const campaignProfile = await prisma.campaignProfile.create({
            data: {
              campaignId: campaign.id,
              profileId: profile.profileId,
              status: "PENDING",
            },
          });

          // Agrupar servicios por plataforma
          for (const service of profile.services) {
            const profileService = await prisma.profileService.findUnique({
              where: { id: service.serviceId },
              include: { socialAccount: true },
            });

            if (profileService) {
              // Buscar o crear CampaignProfilePlatform
              let campaignPlatform = await prisma.campaignProfilePlatform.findFirst({
                where: {
                  campaignProfileId: campaignProfile.id,
                  socialAccountId: profileService.socialAccountId,
                },
              });

              if (!campaignPlatform) {
                campaignPlatform = await prisma.campaignProfilePlatform.create({
                  data: {
                    campaignProfileId: campaignProfile.id,
                    socialAccountId: profileService.socialAccountId,
                  },
                });
              }

              // Crear el servicio de campaña
              await prisma.campaignService.create({
                data: {
                  campaignProfilePlatformId: campaignPlatform.id,
                  profileServiceId: service.serviceId,
                  quantity: service.quantity,
                  basePrice: service.price,
                },
              });
            }
          }
        }

        // Invalidar cache de campañas
        revalidateTag("campaigns", "max");

        return {
          result: JSON.stringify({
            exito: true,
            mensaje: "Campaña creada exitosamente",
            campaignId: campaign.id,
            url: `/campaigns/${campaign.id}`,
          }),
          updatedState: {
            campaignCreatedId: campaign.id,
          },
        };
      } catch (error) {
        console.error("Error creando campaña:", error);
        return {
          result: `ERROR_CRITICO: No se pudo crear la campaña. Razón: ${error instanceof Error ? error.message : "Error desconocido"}. Informa al usuario que hubo un error.`,
        };
      }
    }

    case "add_profile_to_campaign": {
      const { profileId, services } = toolInput as {
        profileId: string;
        services: { serviceId: string; quantity: number }[];
      };

      const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        include: {
          socialAccounts: {
            include: {
              services: {
                include: { serviceType: true },
              },
            },
          },
        },
      });

      if (!profile) {
        return { result: "Perfil no encontrado." };
      }

      const profileServices = services.map((s) => {
        let serviceName = "";
        let price = 0;

        for (const sa of profile.socialAccounts) {
          const found = sa.services.find((sv) => sv.id === s.serviceId);
          if (found) {
            serviceName = found.serviceType.displayName;
            price = calculateMarkupPrice(Number(found.price));
            break;
          }
        }

        return {
          serviceId: s.serviceId,
          serviceName,
          quantity: s.quantity,
          price,
        };
      });

      const newProfile = {
        profileId,
        profileName: profile.name,
        services: profileServices,
      };

      return {
        result: `Perfil "${profile.name}" agregado con ${services.length} formato(s).`,
        updatedState: {
          selectedProfiles: [...campaignState.selectedProfiles, newProfile],
        },
      };
    }

    case "remove_profile_from_campaign": {
      const { profileId } = toolInput as { profileId: string };
      const updated = campaignState.selectedProfiles.filter((p) => p.profileId !== profileId);

      return {
        result: "Perfil removido de la campaña.",
        updatedState: {
          selectedProfiles: updated,
        },
      };
    }

    case "clear_campaign": {
      return {
        result: "Campaña limpiada. Puedes empezar de nuevo.",
        updatedState: {
          name: undefined,
          clientId: undefined,
          clientContactId: undefined,
          budget: undefined,
          description: undefined,
          startDate: undefined,
          endDate: undefined,
          selectedProfiles: [],
        },
      };
    }

    default:
      return { result: `Tool "${toolName}" no implementado.` };
  }
}

export async function POST(request: NextRequest) {
  try {
    // El asistente crea campanas, asi que exige el permiso de crearlas.
    const sesion = await exigirPermiso("campanas", "crear");
    if (sesion instanceof NextResponse) return sesion;

    const body: ChatRequest = await request.json();
    const { messages, campaignState } = body;

    // Crear contexto adicional con el estado actual
    const stateContext = `
Estado actual de la campaña:
- Nombre: ${campaignState.name || "No definido"}
- Cliente ID: ${campaignState.clientId || "No seleccionado"}
- Contacto ID: ${campaignState.clientContactId || "No seleccionado"}
- Presupuesto: ${campaignState.budget ? `$${campaignState.budget.toLocaleString()}` : "No definido"}
- Perfiles seleccionados: ${campaignState.selectedProfiles.length}
${campaignState.selectedProfiles.length > 0 ? `  - ${campaignState.selectedProfiles.map((p) => p.profileName).join(", ")}` : ""}
`;

    // Enviar a Claude
    let response = await sendMessageToAI(messages, stateContext);
    let updatedState = { ...campaignState };
    let finalContent = "";

    // Procesar respuesta y tool calls
    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        const { result, updatedState: newState } = await executeTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          updatedState,
          sesion.userId,
          sesion.email
        );

        if (newState) {
          updatedState = { ...updatedState, ...newState };
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      // Continuar la conversación con los resultados
      const updatedMessages: Anthropic.MessageParam[] = [
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "assistant" as const, content: response.content },
        { role: "user" as const, content: toolResults },
      ];

      response = await sendMessageToAI(
        updatedMessages.map((m) => ({
          role: m.role,
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        })),
        stateContext
      );
    }

    // Extraer contenido de texto final
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    finalContent = textBlocks.map((b) => b.text).join("\n");

    return NextResponse.json({
      content: finalContent,
      campaignState: updatedState,
    });
  } catch (error) {
    console.error("Error en chat:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error en el chat" },
      { status: 500 }
    );
  }
}
