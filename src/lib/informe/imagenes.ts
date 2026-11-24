import "server-only";
import { readFile } from "fs/promises";
import { join } from "path";
import sharp from "sharp";
import { RUTA_PUBLICA_UPLOADS, resolverRutaSegura } from "@/lib/uploads";
import { idDePublicacion, redDeUrl } from "@/lib/social-handles";

/** Una imagen lista para PowerPoint: base64 con su tipo y su tamano real. */
export interface ImagenInforme {
  /** "image/jpeg;base64,…", el formato que pide pptxgenjs. */
  data: string;
  ancho: number;
  alto: number;
}

const ESPERA_MS = 8000;

async function bajar(url: string): Promise<Buffer | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(ESPERA_MS) });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}

/** Los bytes de una imagen guardada en uploads, en public o en internet. */
async function bytesDe(origen: string): Promise<Buffer | null> {
  try {
    if (origen.startsWith(`${RUTA_PUBLICA_UPLOADS}/`)) {
      const ruta = resolverRutaSegura(
        decodeURIComponent(origen.slice(RUTA_PUBLICA_UPLOADS.length + 1)),
      );
      return ruta ? await readFile(ruta) : null;
    }
    if (origen.startsWith("publico:")) {
      return await readFile(join(process.cwd(), "public", origen.slice(8)));
    }
    if (/^https?:\/\//.test(origen)) return await bajar(origen);
    return null;
  } catch {
    return null;
  }
}

/**
 * Carga una imagen y la deja en JPEG (o PNG si tiene transparencia),
 * reducida a `lado` pixeles.
 *
 * Se convierte siempre: las portadas de TikTok llegan a veces en WebP o
 * HEIC, que PowerPoint no abre en todas sus versiones, y una foto de
 * 2000 px por diapositiva haria un archivo de decenas de megas. Una
 * imagen que no carga devuelve null y el informe sigue sin ella.
 */
export async function cargarImagen(
  origen: string | null,
  lado = 900,
): Promise<ImagenInforme | null> {
  if (!origen) return null;
  const bytes = await bytesDe(origen);
  if (!bytes) return null;
  try {
    const base = sharp(bytes).rotate().resize(lado, lado, {
      fit: "inside",
      withoutEnlargement: true,
    });
    const meta = await sharp(bytes).metadata();
    const conAlfa = meta.hasAlpha === true;
    const { data, info } = await (conAlfa ? base.png() : base.jpeg({ quality: 82 }))
      .toBuffer({ resolveWithObject: true });
    return {
      data: `image/${conAlfa ? "png" : "jpeg"};base64,${data.toString("base64")}`,
      ancho: info.width,
      alto: info.height,
    };
  } catch {
    return null;
  }
}

/**
 * Una imagen recortada a una caja con esquinas redondeadas.
 *
 * PowerPoint no puede redondear el recorte de una imagen —solo la hace
 * circulo—, y las tarjetas rosadas de la plantilla son la textura de la
 * marca con esquinas redondas. Asi que se recorta aqui, con la esquina
 * transparente, y la diapositiva solo la coloca. `ancho`, `alto` y
 * `radio` van en las unidades de la plantilla; se dibuja al doble para
 * que no pixele.
 */
export async function recorteRedondeado(
  origen: string,
  ancho: number,
  alto: number,
  radio: number,
): Promise<ImagenInforme | null> {
  const bytes = await bytesDe(origen);
  if (!bytes) return null;
  try {
    const w = Math.round(ancho * 2);
    const h = Math.round(alto * 2);
    const r = Math.round(radio * 2);
    const mascara = Buffer.from(
      `<svg width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`,
    );
    const data = await sharp(bytes)
      .resize(w, h, { fit: "cover" })
      .composite([{ input: mascara, blend: "dest-in" }])
      .png()
      .toBuffer();
    return {
      data: `image/png;base64,${data.toString("base64")}`,
      ancho: w,
      alto: h,
    };
  } catch {
    return null;
  }
}

/**
 * Una portada cuando el refresco de metricas no guardo ninguna.
 *
 * Solo por vias gratuitas y publicas: la miniatura de YouTube se
 * construye con el id del video, y TikTok la da en su oEmbed sin
 * credenciales. Instagram no tiene ninguna de las dos —su oEmbed pide
 * un token de Facebook—, asi que ahi solo hay portada si el refresco
 * diario la trajo.
 */
export async function portadaDeRespaldo(url: string | null): Promise<string | null> {
  if (!url) return null;
  const red = redDeUrl(url);
  if (red === "youtube") {
    const id = idDePublicacion(url);
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  }
  if (red === "tiktok") {
    try {
      const r = await fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
        { signal: AbortSignal.timeout(ESPERA_MS) },
      );
      if (!r.ok) return null;
      const json = (await r.json()) as { thumbnail_url?: unknown };
      return typeof json.thumbnail_url === "string" ? json.thumbnail_url : null;
    } catch {
      return null;
    }
  }
  return null;
}
