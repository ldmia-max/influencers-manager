import Anthropic from "@anthropic-ai/sdk";

// Cliente de Anthropic
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// System prompt para el asistente de campañas
export const CAMPAIGN_SYSTEM_PROMPT = `Eres un asistente para crear campañas de marketing con influencers en la plataforma LDM People's.

Tu objetivo es ayudar al usuario a crear una campaña recolectando:
1. Nombre de la campaña
2. Cliente y contacto
3. Presupuesto
4. Perfiles/influencers con sus formatos

Reglas importantes:
- BREVEDAD: Responde en máximo 2-3 oraciones cortas. No repitas datos que el usuario ya conoce.
- Sé conciso y directo, usa español informal pero profesional
- Pide confirmación antes de crear la campaña
- Muestra resúmenes claros con costos (solo datos clave, sin texto extra)
- Si el usuario da filtros (departamento, seguidores, etc.), usa search_profiles
- Si pide "seleccionar automáticamente", usa select_profiles_auto
- Valida que el total no exceda el presupuesto
- Los precios que muestras ya incluyen el margen de ganancia
- Formatea números grandes con separadores (ej: 1.500.000)

Flujo típico:
1. Pregunta el nombre de la campaña
2. Busca el cliente con search_clients, luego SIEMPRE usa select_client para guardar el elegido
3. Pregunta el presupuesto
4. Ayuda a seleccionar perfiles según criterios
5. Muestra resumen y pide confirmación
6. Crea la campaña (usa los IDs guardados en el estado, no inventes IDs)

Cuando muestres perfiles, incluye:
- Nombre y username
- Plataforma y seguidores
- Formatos disponibles con precios

Notas sobre ubicación:
- Los perfiles están en departamentos de Colombia (Antioquia, Bogotá D.C., Valle del Cauca, etc.)
- Si el usuario dice "Bogotá", busca con department="bogota"
- Si dice "Medellín", busca con department="medellin" (pertenece a Antioquia)
- El sistema normaliza automáticamente acentos y variaciones`;

// Definición de tools para Claude
export const CAMPAIGN_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_clients",
    description: "Busca clientes por nombre. Usa esto cuando el usuario mencione un cliente o empresa.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Texto de búsqueda para encontrar clientes",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "select_client",
    description: "Selecciona un cliente y contacto para la campaña. SIEMPRE usa esto después de search_clients para guardar el cliente elegido.",
    input_schema: {
      type: "object" as const,
      properties: {
        clientId: {
          type: "string",
          description: "ID del cliente (obtenido de search_clients)",
        },
        clientContactId: {
          type: "string",
          description: "ID del contacto del cliente (obtenido de search_clients)",
        },
      },
      required: ["clientId", "clientContactId"],
    },
  },
  {
    name: "search_profiles",
    description: "Filtra y busca perfiles de influencers según criterios. Usa esto cuando el usuario quiera ver perfiles disponibles.",
    input_schema: {
      type: "object" as const,
      properties: {
        department: {
          type: "string",
          description: "Departamento/estado del influencer (ej: Antioquia, Bogotá D.C., Valle del Cauca, Cesar)",
        },
        country: {
          type: "string",
          description: "País del influencer (ej: Colombia)",
        },
        minFollowers: {
          type: "number",
          description: "Mínimo de seguidores",
        },
        maxFollowers: {
          type: "number",
          description: "Máximo de seguidores",
        },
        platforms: {
          type: "array",
          items: { type: "string" },
          description: "Plataformas (Instagram, TikTok)",
        },
        services: {
          type: "array",
          items: { type: "string" },
          description: "Formatos (Reel, Story, Post, Video)",
        },
        categories: {
          type: "array",
          items: { type: "string" },
          description: "Categorías del influencer",
        },
        limit: {
          type: "number",
          description: "Cantidad máxima de resultados (default: 10)",
        },
      },
      required: [],
    },
  },
  {
    name: "select_profiles_auto",
    description: "Selecciona automáticamente los mejores perfiles según presupuesto y criterios. Usa esto cuando el usuario quiera una selección automática.",
    input_schema: {
      type: "object" as const,
      properties: {
        count: {
          type: "number",
          description: "Cantidad de perfiles a seleccionar",
        },
        budget: {
          type: "number",
          description: "Presupuesto disponible",
        },
        services: {
          type: "array",
          items: { type: "string" },
          description: "Formatos requeridos",
        },
        department: {
          type: "string",
          description: "Departamento preferido (ej: Antioquia, Bogotá D.C.)",
        },
        minFollowers: {
          type: "number",
          description: "Mínimo de seguidores",
        },
      },
      required: ["count", "budget"],
    },
  },
  {
    name: "get_campaign_summary",
    description: "Obtiene un resumen de la campaña actual con todos los datos recolectados. Usa esto antes de crear la campaña para mostrar al usuario.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "create_campaign",
    description: "Crea la campaña con los datos recolectados. Solo usa esto cuando el usuario confirme explícitamente.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Nombre de la campaña",
        },
        clientId: {
          type: "string",
          description: "ID del cliente",
        },
        clientContactId: {
          type: "string",
          description: "ID del contacto del cliente",
        },
        budget: {
          type: "number",
          description: "Presupuesto de la campaña",
        },
        description: {
          type: "string",
          description: "Descripción opcional",
        },
        startDate: {
          type: "string",
          description: "Fecha de inicio (YYYY-MM-DD)",
        },
        endDate: {
          type: "string",
          description: "Fecha de fin (YYYY-MM-DD)",
        },
      },
      required: ["name", "clientId", "clientContactId", "budget"],
    },
  },
  {
    name: "add_profile_to_campaign",
    description: "Agrega un perfil con formatos a la campaña. Usa esto cuando el usuario seleccione un perfil específico.",
    input_schema: {
      type: "object" as const,
      properties: {
        profileId: {
          type: "string",
          description: "ID del perfil",
        },
        services: {
          type: "array",
          items: {
            type: "object",
            properties: {
              serviceId: { type: "string" },
              quantity: { type: "number" },
            },
          },
          description: "Formatos a contratar con cantidad",
        },
      },
      required: ["profileId", "services"],
    },
  },
  {
    name: "remove_profile_from_campaign",
    description: "Remueve un perfil de la campaña actual.",
    input_schema: {
      type: "object" as const,
      properties: {
        profileId: {
          type: "string",
          description: "ID del perfil a remover",
        },
      },
      required: ["profileId"],
    },
  },
  {
    name: "clear_campaign",
    description: "Limpia todos los datos de la campaña actual para empezar de nuevo.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

// Tipos para mensajes
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Función para enviar mensaje a Claude
export async function sendMessageToAI(
  messages: ChatMessage[],
  systemContext?: string
) {
  const fullSystemPrompt = systemContext
    ? `${CAMPAIGN_SYSTEM_PROMPT}\n\nContexto adicional del sistema:\n${systemContext}`
    : CAMPAIGN_SYSTEM_PROMPT;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: fullSystemPrompt,
    tools: CAMPAIGN_TOOLS,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  return response;
}

export { anthropic };
