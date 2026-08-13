import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/ai";

// =============================================================================
// Interfaces (re-exported from models/)
// =============================================================================

export type { NormalizedSocialData, AIProfileAnalysis } from "@/models/social";
import type { NormalizedSocialData, AIProfileAnalysis } from "@/models/social";

// =============================================================================
// Funciones de limpieza (Pure Functions)
// =============================================================================

/**
 * Limpia y normaliza datos crudos de Instagram (Apify: apify/instagram-profile-scraper).
 *
 * Estructura esperada del JSON crudo:
 * {
 *   username, fullName, biography, profilePicUrlHD,
 *   followersCount, followsCount, postsCount, verified,
 *   engagementRate,
 *   latestPosts: [{ caption, ... }, ...]
 * }
 */
export function cleanInstagramData(rawJson: unknown): NormalizedSocialData {
  const data = rawJson as Record<string, unknown>;
  const latestPosts: Record<string, unknown>[] = Array.isArray(data.latestPosts)
    ? data.latestPosts
    : [];

  const captions = latestPosts
    .slice(0, 10)
    .map((p) => String(p.caption || p.text || "").trim())
    .filter(Boolean);

  const bio = String(data.biography || "").trim();
  const recentContentText = [bio, ...captions].filter(Boolean).join("\n\n");

  return {
    username: String(data.username || ""),
    fullName: data.fullName ? String(data.fullName) : null,
    biography: bio || null,
    profilePicUrl: data.profilePicUrlHD
      ? String(data.profilePicUrlHD)
      : data.profilePicUrl
        ? String(data.profilePicUrl)
        : null,
    followers: data.followersCount != null ? Number(data.followersCount) : null,
    following: data.followsCount != null ? Number(data.followsCount) : null,
    posts: data.postsCount != null ? Number(data.postsCount) : null,
    totalLikes: null,
    avgViews: null,
    engagementRate: data.engagementRate != null ? Number(data.engagementRate) : null,
    verified: data.verified != null ? Boolean(data.verified) : null,
    recentContentText,
  };
}

/**
 * Limpia y normaliza datos crudos de TikTok (Apify: clockworks/tiktok-scraper).
 *
 * Estructura esperada del JSON crudo (array de videos con authorMeta):
 * [
 *   {
 *     text: "caption del video",
 *     authorMeta: { name, nickName, signature, fans, following, heart, video, avatar, verified },
 *     ...
 *   }
 * ]
 *
 * O bien un objeto con authorMeta directamente (tiktok-profile-scraper).
 */
export function cleanTikTokData(rawJson: unknown): NormalizedSocialData {
  // TikTok puede venir como array de videos o como objeto con authorMeta
  const videos: Record<string, unknown>[] = Array.isArray(rawJson) ? rawJson : [];
  const rawObj = (Array.isArray(rawJson) ? {} : rawJson) as Record<string, unknown>;
  const authorMeta = (videos[0]?.authorMeta ?? rawObj.authorMeta ?? rawObj) as Record<string, unknown>;

  const videoCaptions = videos
    .slice(0, 10)
    .map((v) => String(v.text || "").trim())
    .filter(Boolean);

  const bio = String(authorMeta.signature || "").trim();
  const recentContentText = [bio, ...videoCaptions].filter(Boolean).join("\n\n");

  return {
    username: String(authorMeta.name || authorMeta.username || ""),
    fullName: authorMeta.nickName
      ? String(authorMeta.nickName)
      : authorMeta.nickname
        ? String(authorMeta.nickname)
        : null,
    biography: bio || null,
    profilePicUrl: authorMeta.avatar ? String(authorMeta.avatar) : null,
    followers: authorMeta.fans != null ? Number(authorMeta.fans) : null,
    following: authorMeta.following != null ? Number(authorMeta.following) : null,
    posts: authorMeta.video != null ? Number(authorMeta.video) : null,
    totalLikes: authorMeta.heart != null ? Number(authorMeta.heart) : null,
    avgViews: null,
    engagementRate: null,
    verified: authorMeta.verified != null ? Boolean(authorMeta.verified) : null,
    recentContentText,
  };
}

// =============================================================================
// Servicio de IA (Anthropic)
// =============================================================================

const AI_ANALYSIS_SYSTEM_PROMPT = `Eres un estratega de marketing digital especializado en influencers.
Analiza el perfil del creador de contenido y devuelve SOLO un JSON válido (sin markdown, sin backticks) con esta estructura exacta:
{
  "tags": ["tag1", "tag2", ...],
  "summary": "Resumen en 2 frases del perfil y su contenido.",
  "tone": "tono general del contenido (ej: humorístico, educativo, aspiracional, casual, profesional)",
  "language": "idioma principal del contenido (ej: es, en, pt)"
}

Reglas:
- tags: máximo 8 tags relevantes para marcas (ej: fitness, moda, humor, tech, lifestyle, beauty, food, travel)
- summary: máximo 2 frases concisas en español
- Si no hay suficiente contenido, infiere lo que puedas del username y bio`;

/**
 * Analiza un perfil con IA (Anthropic Haiku) y devuelve metadata estructurada.
 */
export async function analyzeProfileWithAI(
  profileContext: string
): Promise<AIProfileAnalysis> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: AI_ANALYSIS_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Analiza este perfil de creador de contenido:\n\n${profileContext}`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const raw = textBlock?.text || "{}";

  try {
    const parsed = JSON.parse(raw);
    return {
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      summary: String(parsed.summary || ""),
      tone: String(parsed.tone || ""),
      language: String(parsed.language || ""),
    };
  } catch {
    console.error("Error parsing AI response:", raw);
    return { tags: [], summary: "", tone: "", language: "" };
  }
}

// =============================================================================
// Función principal
// =============================================================================

export interface ProcessResult {
  success: boolean;
  socialAccountId: string;
  aiAnalysis: AIProfileAnalysis | null;
  error?: string;
}

/**
 * Procesa datos crudos de redes sociales: limpia, enriquece con IA y guarda en DB.
 *
 * @param platform - Plataforma de origen ('INSTAGRAM' | 'TIKTOK')
 * @param rawData - JSON crudo de Apify
 * @param socialAccountId - ID del SocialAccount existente en la base de datos
 */
export async function processAndSaveSocialProfile(
  platform: "INSTAGRAM" | "TIKTOK",
  rawData: unknown,
  socialAccountId: string
): Promise<ProcessResult> {
  try {
    // 1. Limpiar datos según plataforma
    const normalized =
      platform === "INSTAGRAM"
        ? cleanInstagramData(rawData)
        : cleanTikTokData(rawData);

    // 2. Analizar con IA (solo si hay contenido suficiente)
    let aiAnalysis: AIProfileAnalysis | null = null;
    if (normalized.recentContentText.length > 20) {
      aiAnalysis = await analyzeProfileWithAI(normalized.recentContentText);
    }

    // 3. Guardar en base de datos
    const updated = await prisma.socialAccount.update({
      where: { id: socialAccountId },
      data: {
        fullName: normalized.fullName,
        biography: normalized.biography,
        profilePicUrl: normalized.profilePicUrl,
        verified: normalized.verified,
        followers: normalized.followers,
        following: normalized.following,
        posts: normalized.posts,
        avgLikes: normalized.totalLikes,
        avgViews: normalized.avgViews,
        engagementRate: normalized.engagementRate,
        lastSyncAt: new Date(),
        ...(aiAnalysis && {
          aiSummary: aiAnalysis.summary,
          aiMetadata: {
            tags: aiAnalysis.tags,
            tone: aiAnalysis.tone,
            language: aiAnalysis.language,
            analyzedAt: new Date().toISOString(),
          },
        }),
      },
    });

    return {
      success: true,
      socialAccountId: updated.id,
      aiAnalysis,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error(`[SocialDataProcessor] Error processing ${platform} profile:`, error);
    return {
      success: false,
      socialAccountId,
      aiAnalysis: null,
      error: message,
    };
  }
}
