/**
 * Normalizacion del identificador de una cuenta social.
 *
 * Quien da de alta un creador copia la URL desde la propia plataforma,
 * que es donde tiene el perfil delante. Antes habia que teclear el
 * identificador a mano y pegar la URL fallaba en silencio: el perfil se
 * creaba con las metricas a cero y, peor, ese texto se usaba tambien
 * para construir los enlaces que ve el cliente en el portal de
 * aprobacion, que quedaban rotos.
 *
 * Aqui se acepta cualquier forma razonable y se guarda siempre el
 * identificador limpio.
 *
 * Modulo puro: sin dependencias, para poder usarlo en el navegador y en
 * el servidor.
 */

/** Un id de canal de YouTube: empieza por UC y son 24 caracteres. */
const ID_CANAL_YOUTUBE = /^UC[\w-]{22}$/;

export function esIdDeCanalYouTube(valor: string): boolean {
  return ID_CANAL_YOUTUBE.test(valor);
}

/**
 * Extrae el identificador a partir de lo que sea que hayan escrito.
 *
 * Acepta el identificador suelto, con arroba, la URL completa, sin
 * protocolo, con parametros o con barra final.
 *
 * Si no reconoce el formato devuelve el texto recortado en vez de
 * vaciarlo: es preferible guardar algo aprovechable a descartar la
 * entrada del usuario.
 */
export function normalizarUsuarioSocial(
  plataforma: string,
  valor: string
): string {
  const bruto = (valor ?? "").trim();
  if (!bruto) return "";

  const red = plataforma.trim().toLowerCase();

  // Sin barras ni puntos de dominio: ya es un identificador suelto.
  if (!bruto.includes("/") && !/\b(instagram|tiktok|youtube|kick)\.com/i.test(bruto)) {
    return bruto.replace(/^@/, "");
  }

  // Se descarta el protocolo, el dominio, los parametros y el ancla,
  // y queda la ruta en segmentos.
  const sinProtocolo = bruto.replace(/^[a-z]+:\/\//i, "");
  const sinDominio = sinProtocolo.replace(
    /^(www\.|m\.)?(instagram|tiktok|youtube|kick)\.com\/?/i,
    ""
  );
  const ruta = sinDominio.split(/[?#]/)[0];
  const partes = ruta.split("/").filter(Boolean);

  if (partes.length === 0) return bruto.replace(/^@/, "");

  if (red === "youtube") {
    // youtube.com/@handle | /channel/UCxxx | /c/Nombre | /user/Nombre
    const [primero, segundo] = partes;
    if (primero.startsWith("@")) return primero.slice(1);
    if (["channel", "c", "user"].includes(primero.toLowerCase())) {
      return segundo ?? "";
    }
    return primero;
  }

  // instagram.com/nombre, tiktok.com/@nombre, kick.com/slug
  return partes[0].replace(/^@/, "");
}

/**
 * URL publica del perfil, para enlazarlo desde la interfaz.
 *
 * Los canales de YouTube identificados por id no admiten la forma con
 * arroba y necesitan /channel/.
 */
export function urlDelPerfil(plataforma: string, usuario: string): string | null {
  const red = plataforma.trim().toLowerCase();
  const u = normalizarUsuarioSocial(red, usuario);
  if (!u) return null;

  if (red === "instagram") return `https://www.instagram.com/${u}`;
  if (red === "tiktok") return `https://www.tiktok.com/@${u}`;
  if (red === "kick") return `https://kick.com/${u}`;
  if (red === "youtube") {
    return esIdDeCanalYouTube(u)
      ? `https://www.youtube.com/channel/${u}`
      : `https://www.youtube.com/@${u}`;
  }
  return null;
}
