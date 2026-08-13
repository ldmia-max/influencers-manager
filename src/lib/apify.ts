import { ApifyClient } from "apify-client";
import { put } from "@vercel/blob";

const client = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

export interface InstagramProfileData {
  username: string;
  fullName: string;
  biography: string;
  followersCount: number;
  followsCount: number;
  postsCount: number;
  profilePicUrlHD: string;
  profilePicLocalPath?: string; // URL en Vercel Blob
  isVerified: boolean;
  engagementRate?: number;
}

/**
 * Descarga una imagen de perfil y la sube a Vercel Blob
 * @param imageUrl URL de la imagen a descargar
 * @param username Nombre de usuario para nombrar el archivo
 * @returns URL pública del archivo en Vercel Blob
 */
async function downloadProfilePicture(
  imageUrl: string,
  username: string
): Promise<string | null> {
  try {
    // Descargar la imagen
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determinar extensión del archivo
    const contentType = response.headers.get("content-type");
    const ext = contentType?.includes("png") ? "png" : "jpg";

    // Subir a Vercel Blob
    const filename = `profiles/${username}_${Date.now()}.${ext}`;
    const blob = await put(filename, buffer, {
      access: "public",
      contentType: contentType || "image/jpeg",
    });

    // Retornar URL pública de Vercel Blob
    return blob.url;
  } catch (error) {
    console.error("Error downloading profile picture:", error);
    return null;
  }
}

export interface TikTokProfileData {
  username: string;
  nickname: string;
  signature: string;
  followerCount: number;
  followingCount: number;
  heartCount: number;
  videoCount: number;
  avatarUrl: string;
  avatarLocalPath?: string; // URL en Vercel Blob
  verified: boolean;
}

export async function getInstagramProfile(
  username: string
): Promise<InstagramProfileData | null> {
  try {
    const run = await client.actor("apify/instagram-profile-scraper").call({
      usernames: [username],
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (items.length === 0) return null;

    const profile = items[0] as Record<string, unknown>;

    // Descargar y guardar la foto de perfil HD localmente
    const profilePicUrlHD = String(profile.profilePicUrlHD || "");
    const profilePicLocalPath = profilePicUrlHD
      ? await downloadProfilePicture(profilePicUrlHD, String(profile.username))
      : null;

    return {
      username: String(profile.username || ""),
      fullName: String(profile.fullName || ""),
      biography: String(profile.biography || ""),
      followersCount: Number(profile.followersCount || 0),
      followsCount: Number(profile.followsCount || 0),
      postsCount: Number(profile.postsCount || 0),
      profilePicUrlHD,
      profilePicLocalPath: profilePicLocalPath || undefined,
      isVerified: Boolean(profile.verified),
      engagementRate: profile.engagementRate
        ? Number(profile.engagementRate)
        : undefined,
    };
  } catch (error) {
    console.error("Error fetching Instagram profile:", error);
    return null;
  }
}

export async function getTikTokProfile(
  username: string
): Promise<TikTokProfileData | null> {
  try {
    const run = await client.actor("clockworks/tiktok-profile-scraper").call({
      profiles: [username],
      resultsPerPage: 1,
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (items.length === 0) return null;

    const item = items[0] as Record<string, unknown>;
    const authorMeta = item.authorMeta as Record<string, unknown>;

    if (!authorMeta) return null;

    // Descargar y guardar el avatar localmente
    const avatarUrl = String(authorMeta.avatar || "");
    const avatarLocalPath = avatarUrl
      ? await downloadProfilePicture(avatarUrl, String(authorMeta.name))
      : null;

    return {
      username: String(authorMeta.name || ""),
      nickname: String(authorMeta.nickName || ""),
      signature: String(authorMeta.signature || ""),
      followerCount: Number(authorMeta.fans || 0),
      followingCount: Number(authorMeta.following || 0),
      heartCount: Number(authorMeta.heart || 0),
      videoCount: Number(authorMeta.video || 0),
      avatarUrl,
      avatarLocalPath: avatarLocalPath || undefined,
      verified: Boolean(authorMeta.verified),
    };
  } catch (error) {
    console.error("Error fetching TikTok profile:", error);
    return null;
  }
}

export async function syncSocialAccountMetrics(
  platform: "instagram" | "tiktok",
  username: string
) {
  if (platform === "instagram") {
    const data = await getInstagramProfile(username);
    if (!data) return null;

    return {
      fullName: data.fullName,
      biography: data.biography,
      verified: data.isVerified,
      profilePicUrl: data.profilePicLocalPath || null,
      followers: data.followersCount,
      following: data.followsCount,
      posts: data.postsCount,
      engagementRate: data.engagementRate,
    };
  }

  if (platform === "tiktok") {
    const data = await getTikTokProfile(username);
    if (!data) return null;

    return {
      fullName: data.nickname,
      biography: data.signature,
      verified: data.verified,
      profilePicUrl: data.avatarLocalPath || null,
      followers: data.followerCount,
      following: data.followingCount,
      posts: data.videoCount,
      avgLikes: data.heartCount,
    };
  }

  return null;
}
