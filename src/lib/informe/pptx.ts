import "server-only";
import PptxGenJS from "pptxgenjs";
import {
  APARTADOS_ANALISIS,
  type Analisis,
  type Cifra,
  type DatosInforme,
  type InfluencerInforme,
} from "./tipos";
import {
  costosDeCampana,
  cpe,
  cpv,
  mayorEn,
  mejorEn,
  miles,
  pesos,
  pesosConDecimales,
  porcentaje,
  vecesLoPrevisto,
  veces,
} from "./calculos";
import {
  cargarImagen,
  portadaDeRespaldo,
  recorteRedondeado,
  type ImagenInforme,
} from "./imagenes";

/*
 * El informe de resultados en PowerPoint, con la diagramacion de la
 * plantilla de mercadeo (ayudas/Ejemplo-Informe-campaña.pdf).
 *
 * La plantilla mide 1440 × 810 unidades y la diapositiva panoramica
 * 13,33 × 7,5 pulgadas: una unidad es 1/108 de pulgada. Las medidas de
 * abajo estan escritas en unidades de la plantilla y se convierten con
 * `u()`, para que comparar con el PDF sea leer el mismo numero. Los
 * tamanos de letra, igual: `pt()` pasa los del PDF a puntos.
 *
 * Lo que la app no sabe no se inventa: sin brief no hay diapositiva de
 * objetivos, una cifra que nadie publica sale como raya, y una
 * publicacion sin portada se nombra sin imagen.
 */

const ROSA = "E6336F";
const NEGRO = "1A1A1A";
const GRIS = "5E5E5E";
const CREMA = "FAF6F0";
const BLANCO = "FFFFFF";
const ROSA_CLARO = "F2A9C1";
const ROSA_FONDO = "F7E3EA";
const LINEA = "EFE6DC";
const FUENTE = "Poppins";

/** Unidades de la plantilla → pulgadas. */
const u = (v: number) => v / 108;
/** Tamano de letra del PDF → puntos de PowerPoint. */
const pt = (v: number) => Math.round((v * 2) / 3 * 10) / 10;
/**
 * El tamano (en unidades del PDF) al que un texto cabe en una linea.
 *
 * PowerPoint solo encoge el texto cuando alguien lo edita, no al abrir
 * el archivo, asi que una cifra larga se partia en dos renglones. El
 * tamano se calcula aqui: `em` es el ancho medio de un caracter de
 * Poppins Bold respecto a su tamano.
 */
const cabe = (contenido: string, ancho: number, base: number, em = 0.62) =>
  Math.min(base, ancho / (Math.max(1, contenido.length) * em));

type Diapositiva = PptxGenJS.Slide;

interface Recursos {
  logo: ImagenInforme | null;
  fondo: ImagenInforme | null;
  /** La textura ya recortada con esquinas redondas, una por tarjeta. */
  redondeados: Record<"portada" | "tarjeta" | "inversion" | "cierre", ImagenInforme | null>;
  fotos: Map<string, ImagenInforme | null>;
  portadas: Map<string, ImagenInforme | null>;
}

/** Texto con la letra de la plantilla y sin margenes internos. */
function texto(
  s: Diapositiva,
  contenido: string | PptxGenJS.TextProps[],
  x: number,
  y: number,
  w: number,
  h: number,
  o: PptxGenJS.TextPropsOptions = {},
) {
  s.addText(contenido, {
    x: u(x),
    y: u(y),
    w: u(w),
    h: u(h),
    fontFace: FUENTE,
    color: NEGRO,
    margin: 0,
    valign: "top",
    ...o,
  });
}

function caja(
  s: Diapositiva,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  o: { radio?: number; transparencia?: number; borde?: string; bordeTransparencia?: number } = {},
) {
  s.addShape("roundRect", {
    x: u(x),
    y: u(y),
    w: u(w),
    h: u(h),
    rectRadius: u(o.radio ?? 22),
    fill: { color, transparency: o.transparencia ?? 0 },
    line: o.borde
      ? { color: o.borde, width: 0.75, transparency: o.bordeTransparencia ?? 0 }
      : { type: "none" },
  });
}

function rect(s: Diapositiva, x: number, y: number, w: number, h: number, color: string) {
  s.addShape("rect", {
    x: u(x),
    y: u(y),
    w: u(w),
    h: u(h),
    fill: { color },
    line: { type: "none" },
  });
}

/** Una imagen que llena su caja recortando lo que sobra, sin deformarla. */
function imagenCubriendo(
  s: Diapositiva,
  img: ImagenInforme,
  x: number,
  y: number,
  w: number,
  h: number,
  redondeada = false,
) {
  s.addImage({
    data: img.data,
    x: u(x),
    y: u(y),
    // pptxgenjs recorta a partir de la proporcion de w/h: van las
    // medidas reales de la imagen y la caja en `sizing`.
    w: img.ancho / 100,
    h: img.alto / 100,
    sizing: { type: "cover", w: u(w), h: u(h) },
    rounding: redondeada,
  });
}

/** Una imagen ya hecha a la medida de su caja. */
function colocar(s: Diapositiva, img: ImagenInforme, x: number, y: number, w: number, h: number) {
  s.addImage({ data: img.data, x: u(x), y: u(y), w: u(w), h: u(h) });
}

/** Una imagen entera dentro de su caja, centrada. */
function imagenDentro(
  s: Diapositiva,
  img: ImagenInforme,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const escala = Math.min(w / img.ancho, h / img.alto);
  const iw = img.ancho * escala;
  const ih = img.alto * escala;
  s.addImage({
    data: img.data,
    x: u(x + (w - iw) / 2),
    y: u(y + (h - ih) / 2),
    w: u(iw),
    h: u(ih),
  });
}

/** "— 0 2 · R E S U M E N   G E N E R A L", con su raya rosada delante. */
function antetitulo(s: Diapositiva, contenido: string, x: number, y: number, color = ROSA) {
  rect(s, x, y + 8, 36, 4, color);
  texto(s, contenido.toUpperCase(), x + 50, y - 3, 1100, 30, {
    fontSize: pt(18),
    bold: true,
    color,
    charSpacing: 4,
  });
}

/** "Objetivos de campaña": la primera parte negra y la segunda rosada. */
function titulo(
  s: Diapositiva,
  negro: string,
  rosa: string,
  x: number,
  y: number,
  w = 1100,
  color = NEGRO,
) {
  texto(
    s,
    [
      { text: `${negro} `, options: { color } },
      { text: rosa, options: { color: color === NEGRO ? ROSA : color } },
    ],
    x,
    y,
    w,
    90,
    { fontSize: pt(57), bold: true },
  );
}

function logo(s: Diapositiva, r: Recursos, x: number, y: number, w: number, h: number) {
  if (r.logo) imagenDentro(s, r.logo, x, y, w, h);
}

/** Barra de progreso de la plantilla: fondo palido y relleno. */
function barra(
  s: Diapositiva,
  x: number,
  y: number,
  w: number,
  fraccion: number,
  color: string,
) {
  caja(s, x, y, w, 9, ROSA_FONDO, { radio: 4.5 });
  const f = Math.max(0, Math.min(1, fraccion));
  if (f > 0) caja(s, x, y, Math.max(9, w * f), 9, color, { radio: 4.5 });
}

// ---------------------------------------------------------------- portada

function portada(p: PptxGenJS, d: DatosInforme, r: Recursos) {
  const s = p.addSlide();
  s.background = { color: BLANCO };
  // La mitad derecha crema, como la plantilla. La izquierda llevaba la
  // foto del producto, que la app no tiene: ahi va la textura de la
  // marca para que no quede media portada en blanco.
  rect(s, 697, 0, 743, 810, CREMA);
  if (r.redondeados.portada) colocar(s, r.redondeados.portada, 60, 190, 580, 560);
  logo(s, r, 40, 49, 128, 47);

  rect(s, 767, 243, 36, 4, ROSA);
  texto(s, d.campana.periodo, 816, 232, 600, 30, {
    fontSize: pt(18),
    bold: true,
    color: ROSA,
    charSpacing: 4,
  });
  // El nombre de la campana hace de titulo. Si es largo, la letra baja
  // para que quepa en el espacio de dos lineas de la plantilla.
  const largo = d.campana.nombre.length;
  // Dos renglones como mucho: la palabra mas larga tiene que caber en
  // el ancho, y el total en dos lineas.
  const palabraMasLarga = Math.max(
    ...d.campana.nombre.split(/\s+/).map((p) => p.length),
  );
  const tam = Math.min(
    largo <= 14 ? 96 : largo <= 24 ? 78 : largo <= 40 ? 60 : 46,
    cabe("x".repeat(palabraMasLarga), 640, 96, 0.6),
  );
  texto(s, d.campana.nombre, 767, 270, 640, 220, {
    fontSize: pt(tam),
    bold: true,
    color: NEGRO,
    valign: "middle",
    fit: "shrink",
  });
  texto(s, "Informe de resultados de la campaña con influencers.", 767, 528, 620, 70, {
    fontSize: pt(25.5),
    color: GRIS,
  });
  texto(s, "CAMPAÑA · INFLUENCERS", 767, 728, 380, 26, {
    fontSize: pt(18),
    bold: true,
    color: GRIS,
    charSpacing: 4,
  });
  texto(s, d.campana.cliente.toUpperCase(), 1100, 728, 300, 26, {
    fontSize: pt(18),
    bold: true,
    color: NEGRO,
    charSpacing: 4,
    align: "right",
  });
}

// -------------------------------------------------------------- objetivos

function objetivos(p: PptxGenJS, d: DatosInforme, numero: string) {
  const s = p.addSlide();
  s.background = { color: CREMA };
  antetitulo(s, `${numero} · Objetivos`, 76, 70);
  titulo(s, "Objetivos de", "campaña", 76, 92);

  // Hasta cuatro tarjetas en rejilla de dos, a todo el ancho: la foto
  // del producto que ocupaba la derecha no existe en la app.
  const lista = d.objetivos.slice(0, 4);
  const columnas = lista.length === 1 ? 1 : 2;
  const filas = Math.ceil(lista.length / columnas);
  const anchoTotal = 1288;
  const gap = 18;
  const w = (anchoTotal - gap * (columnas - 1)) / columnas;
  const h = filas === 1 ? 420 : 270;
  lista.forEach((o, i) => {
    const x = 76 + (i % columnas) * (w + gap);
    const y = 210 + Math.floor(i / columnas) * (h + gap);
    caja(s, x, y, w, h, BLANCO, { radio: 22 });
    texto(s, String(i + 1).padStart(2, "0"), x + 32, y + 22, 100, 50, {
      fontSize: pt(36),
      bold: true,
      color: ROSA,
    });
    texto(s, o.titulo, x + 32, y + 76, w - 64, 40, {
      fontSize: pt(27),
      bold: true,
    });
    // La letra se ajusta al largo: el brief es texto libre del cliente.
    const largo = o.texto.length;
    const tam = largo <= 120 ? 19.5 : largo <= 260 ? 17 : largo <= 450 ? 14.5 : 12.5;
    texto(s, o.texto, x + 32, y + 124, w - 64, h - 144, {
      fontSize: pt(tam),
      color: GRIS,
      fit: "shrink",
    });
  });
}

// ---------------------------------------------------------------- resumen

function resumen(p: PptxGenJS, d: DatosInforme, r: Recursos, numero: string) {
  const s = p.addSlide();
  s.background = r.fondo
    ? { data: r.fondo.data }
    : { color: ROSA };
  antetitulo(s, `${numero} · Resumen general`, 76, 70, BLANCO);
  texto(s, "Resultados de la campaña", 76, 92, 830, 90, {
    fontSize: pt(57),
    bold: true,
    color: BLANCO,
  });
  texto(
    s,
    d.fechaDeCorte
      ? `Totales aproximados a la fecha de corte: ${d.fechaDeCorte}`
      : "Todavía no hay mediciones",
    830,
    140,
    550,
    30,
    { fontSize: pt(18), color: BLANCO, align: "right" },
  );

  const res = d.resumen;
  const vidrio = (x: number, y: number, w: number, h: number) =>
    caja(s, x, y, w, h, BLANCO, {
      radio: 22,
      transparencia: 78,
      borde: BLANCO,
      bordeTransparencia: 55,
    });
  const tarjeta = (
    x: number,
    y: number,
    w: number,
    h: number,
    etiqueta: string,
    valor: string,
    estilo: "vidrio" | "blanca" | "negra",
    grande = false,
    sufijo?: string,
  ) => {
    if (estilo === "vidrio") vidrio(x, y, w, h);
    else caja(s, x, y, w, h, estilo === "blanca" ? BLANCO : NEGRO, { radio: 22 });
    const colorEtiqueta = estilo === "blanca" ? ROSA : BLANCO;
    const colorValor = estilo === "blanca" ? NEGRO : BLANCO;
    texto(s, etiqueta.toUpperCase(), x + 27, y + 24, w - 40, 26, {
      fontSize: pt(18),
      bold: true,
      color: colorEtiqueta,
      charSpacing: 2,
    });
    // Con sufijo la cifra comparte renglon: se le deja la mitad. La
    // negrita va por fragmento —puesta en el conjunto, la hereda tambien
    // el sufijo—.
    const tam = cabe(valor, sufijo ? (w - 54) * 0.5 : w - 54, grande ? 72 : 48);
    texto(
      s,
      sufijo
        ? [
            { text: valor, options: { fontSize: pt(tam), bold: true } },
            { text: `  ${sufijo}`, options: { fontSize: pt(18) } },
          ]
        : valor,
      x + 27,
      y + h - (grande ? 115 : 92),
      w - 40,
      grande ? 100 : 80,
      {
        fontSize: pt(tam),
        bold: !sufijo,
        color: colorValor,
        valign: "bottom",
      },
    );
  };

  tarjeta(76, 208, 644, 172, "Visualizaciones totales", miles(res.vistas), "blanca", true);
  tarjeta(736, 208, 314, 172, "Me gusta", miles(res.meGusta), "vidrio");
  tarjeta(1066, 208, 314, 172, "Comentarios", miles(res.comentarios), "vidrio");
  tarjeta(76, 396, 314, 172, "Compartidos", miles(res.compartidos), "vidrio");
  tarjeta(406, 396, 314, 172, "Reposteos", miles(res.reposteos), "vidrio");
  tarjeta(736, 396, 314, 172, "Alcance aprox.", miles(res.alcance), "vidrio");
  tarjeta(1066, 396, 314, 172, "Engagement alcance", porcentaje(res.engagement), "blanca");
  tarjeta(76, 585, 644, 172, "Inversión total", pesos(res.inversion), "negra", true);
  tarjeta(
    736,
    585,
    314,
    172,
    "Publicaciones",
    miles(res.publicaciones),
    "vidrio",
    false,
    `de ${miles(res.pactadas)} pactadas`,
  );
  const factor = vecesLoPrevisto(d);
  tarjeta(
    1066,
    585,
    314,
    172,
    "Vs. previsión",
    veces(factor),
    "vidrio",
    false,
    factor === null ? undefined : "vistas estimadas",
  );
}

// ----------------------------------------------------------- individuales

function individual(
  p: PptxGenJS,
  i: InfluencerInforme,
  r: Recursos,
  numero: string,
  orden: number,
  total: number,
) {
  const s = p.addSlide();
  s.background = { color: CREMA };
  antetitulo(
    s,
    `${numero} · Resultados individuales · ${String(orden).padStart(2, "0")}/${String(total).padStart(2, "0")}`,
    68,
    70,
  );
  const anchoNombre = i.ciudad ? 900 : 1150;
  texto(s, i.nombre.toUpperCase(), 68, 96, anchoNombre, 80, {
    fontSize: pt(cabe(i.nombre, anchoNombre, 57, 0.7)),
    bold: true,
  });
  logo(s, r, 1262, 48, 128, 47);
  if (i.ciudad) {
    texto(s, i.ciudad.toUpperCase(), 980, 118, 406, 60, {
      fontSize: pt(cabe(i.ciudad, 406, 42, 0.7)),
      bold: true,
      color: ROSA,
      align: "right",
    });
  }

  // Columna 1: usuario, foto y ficha.
  if (i.usuario) {
    texto(s, `@${i.usuario} ↗`, 68, 190, 270, 34, {
      fontSize: pt(cabe(`@${i.usuario} ↗`, 270, 22.5, 0.6)),
      bold: true,
      color: "1155CC",
      underline: { style: "sng" },
      align: "center",
      hyperlink: i.urlPerfil ? { url: i.urlPerfil } : undefined,
      fit: "shrink",
    });
  }
  const foto = r.fotos.get(i.campaignProfileId);
  if (foto) {
    imagenCubriendo(s, foto, 84, 238, 240, 314);
  } else {
    caja(s, 84, 238, 240, 314, ROSA_FONDO, { radio: 8 });
    texto(s, i.nombre.slice(0, 1).toUpperCase(), 84, 238, 240, 314, {
      fontSize: 60,
      bold: true,
      color: ROSA,
      align: "center",
      valign: "middle",
    });
  }

  const filas: [string, string, boolean][] = [
    ...i.seguidores.map(
      (f) => [`Seguidores ${f.red}`, miles(f.valor), false] as [string, string, boolean],
    ),
    ["Valor $", pesos(i.valor), true],
    ["Red social", i.redes.join(" · ") || "—", false],
    ["Publicaciones", miles(i.publicaciones), false],
  ];
  const altoFila = 40;
  const altoFicha = filas.length * altoFila + 24;
  const yFicha = 594;
  caja(s, 74, yFicha, 258, Math.min(altoFicha, 810 - yFicha - 20), BLANCO, { radio: 22 });
  filas.slice(0, 5).forEach(([etq, val, rosa], k) => {
    const y = yFicha + 12 + k * altoFila;
    texto(s, etq, 96, y, 120, altoFila, {
      fontSize: pt(17),
      color: GRIS,
      valign: "middle",
    });
    texto(s, val, 190, y, 128, altoFila, {
      fontSize: pt(cabe(val, 128, rosa ? 21 : 19)),
      bold: true,
      color: rosa ? ROSA : NEGRO,
      align: "right",
      valign: "middle",
      fit: "shrink",
    });
  });

  // Columna 2: contenido publicado.
  texto(s, "CONTENIDO PUBLICADO", 360, 196, 320, 30, {
    fontSize: pt(18),
    bold: true,
    color: GRIS,
    charSpacing: 3,
    align: "center",
  });
  // Lo mas destacado primero: por visualizaciones y, a igualdad o sin
  // ellas —un carrusel no publica vistas—, por me gusta. `k` es la
  // posicion original, que es con la que se guardo cada portada.
  const destacadas = i.piezas
    .map((pz, k) => ({ pz, k }))
    .sort(
      (a, b) =>
        (b.pz.vistas ?? -1) - (a.pz.vistas ?? -1) ||
        (b.pz.meGusta ?? -1) - (a.pz.meGusta ?? -1),
    );
  const portadas = destacadas
    .map(({ k }) => r.portadas.get(`${i.campaignProfileId}:${k}`) ?? null)
    .filter((x): x is ImagenInforme => x !== null)
    .slice(0, 2);
  if (portadas.length === 1) {
    // Hasta 506: debajo van los enlaces.
    imagenCubriendo(s, portadas[0], 400, 236, 236, 270);
  } else if (portadas.length === 2) {
    imagenCubriendo(s, portadas[0], 362, 236, 154, 270);
    imagenCubriendo(s, portadas[1], 522, 236, 154, 270);
  } else {
    caja(s, 372, 236, 296, 270, BLANCO, { radio: 16 });
    texto(
      s,
      i.piezas.length === 0
        ? "Todavía no hay publicaciones registradas."
        : "Sin portada disponible: se toma en el refresco diario de métricas.",
      392,
      236,
      256,
      270,
      { fontSize: 10, color: GRIS, align: "center", valign: "middle" },
    );
  }
  // Enlaces: uno por publicacion con link, como "VIDEO REEL" de la
  // plantilla. Las historias no tienen link y no se nombran aqui: estan
  // en la tabla de la derecha.
  const enlaces = destacadas.map(({ pz }) => pz).filter((pz) => pz.url).slice(0, 4);
  enlaces.forEach((pz, k) => {
    const col = enlaces.length > 2 ? k % 2 : 0;
    const fila = enlaces.length > 2 ? Math.floor(k / 2) : k;
    const ancho = enlaces.length > 2 ? 160 : 320;
    texto(s, pz.etiqueta.toUpperCase(), 360 + col * 160, 516 + fila * 30, ancho, 26, {
      fontSize: pt(16.5),
      color: "1155CC",
      underline: { style: "sng" },
      align: "center",
      hyperlink: { url: pz.url! },
      fit: "shrink",
    });
  });

  // La tarjeta rosada de cifras.
  const yCifras = 592;
  if (r.redondeados.tarjeta) colocar(s, r.redondeados.tarjeta, 358, yCifras, 326, 146);
  else caja(s, 358, yCifras, 326, 146, ROSA, { radio: 22 });
  const cifra = (etq: string, v: Cifra, x: number, y: number) => {
    texto(s, etq, x, y, 150, 22, { fontSize: pt(16.5), bold: true, color: BLANCO });
    texto(s, miles(v), x, y + 18, 150, 38, {
      fontSize: pt(cabe(miles(v), 150, 36)),
      bold: true,
      color: BLANCO,
      fit: "shrink",
    });
  };
  cifra("Visualizaciones", i.vistas, 377, yCifras + 14);
  cifra("Alcance aprox.", i.alcance, 540, yCifras + 14);
  cifra("Likes", i.meGusta, 377, yCifras + 78);
  cifra("Comentarios", i.comentarios, 540, yCifras + 78);

  // Columna 3: la plantilla llevaba capturas de comentarios escogidas a
  // mano. La app no las tiene, y en su lugar va lo que si sabe: cada
  // publicacion con sus cifras.
  texto(s, "DETALLE POR PUBLICACIÓN", 720, 196, 680, 30, {
    fontSize: pt(18),
    bold: true,
    color: GRIS,
    charSpacing: 3,
  });
  const piezas = destacadas.map(({ pz }) => pz).slice(0, 9);
  const cabecera = ["Publicación", "Vistas", "Alcance", "Likes", "Coment."];
  const anchos = [262, 98, 98, 90, 92];
  const yTabla = 236;
  caja(s, 712, yTabla, 680, 52 + Math.max(1, piezas.length) * 52, BLANCO, { radio: 18 });
  let x = 732;
  cabecera.forEach((c, k) => {
    texto(s, c.toUpperCase(), x, yTabla + 16, anchos[k], 24, {
      fontSize: pt(14),
      bold: true,
      color: GRIS,
      align: k === 0 ? "left" : "right",
      charSpacing: 1,
    });
    x += anchos[k];
  });
  if (piezas.length === 0) {
    texto(s, "Sin publicaciones registradas.", 732, yTabla + 56, 600, 40, {
      fontSize: pt(16.5),
      color: GRIS,
    });
  }
  piezas.forEach((pz, k) => {
    const y = yTabla + 52 + k * 52;
    rect(s, 732, y, 640, 1, LINEA);
    const valores = [
      pz.etiqueta + (pz.esExtra ? " (extra)" : ""),
      miles(pz.vistas),
      miles(pz.alcance),
      miles(pz.meGusta),
      miles(pz.comentarios),
    ];
    let xx = 732;
    valores.forEach((v, c) => {
      texto(s, v, xx, y + 8, anchos[c] - (c === 0 ? 10 : 0), 36, {
        fontSize: pt(c === 0 ? 16 : 18),
        bold: c !== 0,
        color: c === 0 ? NEGRO : NEGRO,
        align: c === 0 ? "left" : "right",
        valign: "middle",
        hyperlink: c === 0 && pz.url ? { url: pz.url } : undefined,
        fit: "shrink",
      });
      xx += anchos[c];
    });
  });
  if (i.piezas.length > piezas.length) {
    texto(
      s,
      `y ${i.piezas.length - piezas.length} publicaciones más`,
      732,
      yTabla + 60 + piezas.length * 52,
      600,
      24,
      { fontSize: pt(14), color: GRIS },
    );
  }
}

// ------------------------------------------------------------ comparativo

const POR_PAGINA = 6;

function paginas<T>(lista: T[]): T[][] {
  const out: T[][] = [];
  for (let k = 0; k < lista.length; k += POR_PAGINA) {
    out.push(lista.slice(k, k + POR_PAGINA));
  }
  return out.length ? out : [[]];
}

function comparativo(p: PptxGenJS, d: DatosInforme, numero: string) {
  const lista = d.influencers;
  const columnas: {
    etq: string;
    valor: (i: InfluencerInforme) => Cifra;
    fmt: (v: Cifra) => string;
    total: Cifra;
    negra?: boolean;
  }[] = [
    { etq: "Visualiz.", valor: (i) => i.vistas, fmt: miles, total: d.resumen.vistas },
    { etq: "Alcance", valor: (i) => i.alcance, fmt: miles, total: d.resumen.alcance },
    { etq: "Likes", valor: (i) => i.meGusta, fmt: miles, total: d.resumen.meGusta },
    {
      etq: "Comentarios",
      valor: (i) => i.comentarios,
      fmt: miles,
      total: d.resumen.comentarios,
    },
    {
      etq: "Valor",
      valor: (i) => i.valor,
      fmt: pesos,
      total: d.resumen.inversion,
      negra: true,
    },
  ];
  const maximos = columnas.map((c) =>
    Math.max(0, ...lista.map((i) => c.valor(i) ?? 0)),
  );
  const mejores = columnas.map((c) => (c.negra ? null : mayorEn(lista, c.valor)));

  const grupos = paginas(lista);
  grupos.forEach((grupo, g) => {
    const s = p.addSlide();
    s.background = { color: CREMA };
    antetitulo(
      s,
      `${numero} · Comparativo${grupos.length > 1 ? ` · ${g + 1}/${grupos.length}` : ""}`,
      76,
      70,
    );
    titulo(s, "Comparativo de", "influencers", 76, 92);
    caja(s, 1073, 148, 26, 10, ROSA, { radio: 5 });
    texto(s, "Mejor resultado por indicador", 1110, 140, 280, 26, {
      fontSize: pt(18),
      color: GRIS,
    });

    const ultima = g === grupos.length - 1;
    const filas = grupo.length + (ultima ? 1 : 0);
    const altoFila = 84;
    caja(s, 76, 202, 1304, 72 + filas * altoFila, BLANCO, { radio: 22 });
    const xs = [110, 410, 603, 796, 989, 1182];
    const anchoCol = 165;
    texto(s, "CREADOR", xs[0], 222, 260, 24, {
      fontSize: pt(18),
      bold: true,
      color: GRIS,
      charSpacing: 2,
    });
    rect(s, xs[0], 258, 272, 2, ROSA);
    columnas.forEach((c, k) => {
      texto(s, c.etq.toUpperCase(), xs[k + 1], 222, anchoCol, 24, {
        fontSize: pt(cabe(c.etq, anchoCol, 18, 0.85)),
        bold: true,
        color: GRIS,
        charSpacing: 1,
      });
      rect(s, xs[k + 1], 258, anchoCol, 2, ROSA);
    });

    grupo.forEach((i, f) => {
      const y = 270 + f * altoFila;
      if (f > 0) {
        rect(s, xs[0], y - 8, 1236, 1, LINEA);
      }
      texto(s, i.nombre, xs[0], y + 4, 280, 32, {
        fontSize: pt(cabe(i.nombre, 280, 22.5, 0.58)),
        bold: true,
      });
      texto(s, i.usuario ? `@${i.usuario}` : "", xs[0], y + 36, 280, 26, {
        fontSize: pt(18),
        color: GRIS,
      });
      columnas.forEach((c, k) => {
        const v = c.valor(i);
        texto(s, c.fmt(v), xs[k + 1], y + 4, anchoCol, 36, {
          fontSize: pt(cabe(c.fmt(v), anchoCol, 25.5)),
          bold: true,
          fit: "shrink",
        });
        const color = c.negra
          ? NEGRO
          : mejores[k] === i
            ? ROSA
            : ROSA_CLARO;
        barra(s, xs[k + 1], y + 46, anchoCol, maximos[k] ? (v ?? 0) / maximos[k] : 0, color);
      });
    });

    if (ultima) {
      const y = 270 + grupo.length * altoFila;
      rect(s, xs[0], y - 8, 1236, 1, LINEA);
      texto(s, "TOTAL", xs[0], y + 12, 260, 30, {
        fontSize: pt(19.5),
        bold: true,
        charSpacing: 2,
      });
      columnas.forEach((c, k) => {
        texto(s, c.fmt(c.total), xs[k + 1], y + 6, anchoCol, 40, {
          fontSize: pt(cabe(c.fmt(c.total), anchoCol, 28.5)),
          bold: true,
          color: ROSA,
          fit: "shrink",
        });
      });
    }
  });
}

// --------------------------------------------------------------- inversion

function inversion(p: PptxGenJS, d: DatosInforme, r: Recursos, numero: string) {
  const pagados = d.influencers.filter((i) => i.valor !== null);
  const costos = costosDeCampana(d);
  const mejorCpv = mejorEn(pagados, cpv);
  const mejorCpe = mejorEn(pagados, cpe);
  const maxCpv = Math.max(0, ...pagados.map((i) => cpv(i) ?? 0));
  const maxCpe = Math.max(0, ...pagados.map((i) => cpe(i) ?? 0));

  const grupos = paginas(pagados);
  grupos.forEach((grupo, g) => {
    const s = p.addSlide();
    s.background = { color: CREMA };
    antetitulo(
      s,
      `${numero} · Inversión${grupos.length > 1 ? ` · ${g + 1}/${grupos.length}` : ""}`,
      76,
      70,
    );
    titulo(s, "Análisis de", "inversión", 76, 92);

    // Columna izquierda: total, promedios y mejores.
    if (r.redondeados.inversion) colocar(s, r.redondeados.inversion, 76, 202, 409, 245);
    else caja(s, 76, 202, 409, 245, ROSA);
    texto(s, "INVERSIÓN TOTAL", 108, 230, 340, 28, {
      fontSize: pt(18),
      bold: true,
      color: BLANCO,
      charSpacing: 3,
    });
    texto(s, pesos(d.resumen.inversion), 108, 340, 360, 80, {
      fontSize: pt(cabe(pesos(d.resumen.inversion), 360, 54)),
      bold: true,
      color: BLANCO,
      fit: "shrink",
    });
    const promedio = (x: number, etq: string, v: Cifra) => {
      caja(s, x, 462, 197, 142, BLANCO, { radio: 22 });
      texto(s, etq, x + 24, 484, 160, 26, { fontSize: pt(18), bold: true, color: GRIS });
      texto(s, pesosConDecimales(v), x + 24, 528, 165, 50, {
        fontSize: pt(cabe(pesosConDecimales(v), 160, 36)),
        bold: true,
        fit: "shrink",
      });
    };
    promedio(76, "CPV promedio", costos.cpv);
    promedio(288, "CPE promedio", costos.cpe);
    caja(s, 76, 620, 409, 93, NEGRO, { radio: 22 });
    texto(s, "Mejor CPV", 100, 636, 160, 28, { fontSize: pt(18), color: BLANCO });
    texto(s, mejorCpv?.nombre ?? "—", 240, 636, 222, 28, {
      fontSize: pt(cabe(mejorCpv?.nombre ?? "—", 222, 18, 0.58)),
      bold: true,
      color: ROSA_CLARO,
      align: "right",
      fit: "shrink",
    });
    texto(s, "Mejor CPE", 100, 668, 160, 28, { fontSize: pt(18), color: BLANCO });
    texto(s, mejorCpe?.nombre ?? "—", 240, 668, 222, 28, {
      fontSize: pt(cabe(mejorCpe?.nombre ?? "—", 222, 18, 0.58)),
      bold: true,
      color: ROSA_CLARO,
      align: "right",
      fit: "shrink",
    });

    // Tabla de la derecha.
    caja(s, 516, 202, 864, 511, BLANCO, { radio: 22 });
    const xs = [550, 835, 1015, 1195];
    const anchos = [270, 155, 152, 152];
    ["Creador", "Valor", "CPV", "CPE"].forEach((c, k) => {
      texto(s, c.toUpperCase(), xs[k], 224, anchos[k], 24, {
        fontSize: pt(18),
        bold: true,
        color: GRIS,
        charSpacing: 2,
      });
      rect(s, xs[k], 261, anchos[k], 2, ROSA);
    });
    const altoFila = Math.min(88, 440 / Math.max(1, grupo.length));
    grupo.forEach((i, f) => {
      const y = 274 + f * altoFila;
      if (f > 0) rect(s, xs[0], y - 6, 797, 1, LINEA);
      texto(s, i.nombre, xs[0], y + 4, 270, 30, {
        fontSize: pt(cabe(i.nombre, 270, 22.5, 0.58)),
        bold: true,
      });
      texto(s, i.usuario ? `@${i.usuario}` : "", xs[0], y + 34, 270, 26, {
        fontSize: pt(18),
        color: GRIS,
      });
      texto(s, pesos(i.valor), xs[1], y + 12, anchos[1], 36, {
        fontSize: pt(cabe(pesos(i.valor), anchos[1], 22.5)),
        bold: true,
        fit: "shrink",
      });
      const c1 = cpv(i);
      const c2 = cpe(i);
      texto(s, pesosConDecimales(c1), xs[2], y + 4, anchos[2], 32, {
        fontSize: pt(cabe(pesosConDecimales(c1), anchos[2], 22.5)),
        bold: true,
        fit: "shrink",
      });
      barra(s, xs[2], y + 42, anchos[2], maxCpv ? (c1 ?? 0) / maxCpv : 0, mejorCpv === i ? ROSA : ROSA_CLARO);
      texto(s, pesosConDecimales(c2), xs[3], y + 4, anchos[3], 32, {
        fontSize: pt(cabe(pesosConDecimales(c2), anchos[3], 22.5)),
        bold: true,
        fit: "shrink",
      });
      barra(s, xs[3], y + 42, anchos[3], maxCpe ? (c2 ?? 0) / maxCpe : 0, mejorCpe === i ? ROSA : ROSA_CLARO);
    });

    texto(
      s,
      "CPV = valor ÷ visualizaciones · CPE = valor ÷ (likes + comentarios) · Rosado intenso = mayor eficiencia",
      76,
      730,
      1300,
      28,
      { fontSize: pt(18), color: GRIS },
    );
  });
}

// ---------------------------------------------------------------- analisis

function analisis(
  p: PptxGenJS,
  a: Analisis,
  r: Recursos,
  numero: string,
) {
  const s = p.addSlide();
  s.background = { color: BLANCO };
  rect(s, 0, 0, 577, 810, CREMA);
  antetitulo(s, `${numero} · Análisis`, 76, 70);
  texto(
    s,
    [
      { text: "Análisis", options: { color: NEGRO, breakLine: true } },
      { text: "general", options: { color: ROSA } },
    ],
    76,
    92,
    480,
    140,
    { fontSize: pt(57), bold: true, lineSpacingMultiple: 0.85 },
  );
  // A la izquierda la plantilla llevaba la foto del producto; va la
  // textura de la marca.
  if (r.fondo) imagenCubriendo(s, r.fondo, 37, 265, 510, 474);
  logo(s, r, 1262, 48, 128, 47);

  rect(s, 652, 168, 729, 2, ROSA);
  const alto = 540 / APARTADOS_ANALISIS.length;
  APARTADOS_ANALISIS.forEach(({ clave, titulo: t }, k) => {
    const y = 180 + k * alto;
    if (k > 0) rect(s, 652, y - 6, 729, 1, LINEA);
    texto(s, t, 652, y + 8, 230, alto - 16, {
      fontSize: pt(22.5),
      bold: true,
      fit: "shrink",
    });
    const largo = a[clave].length;
    const tam = largo <= 140 ? 18 : largo <= 240 ? 16 : 14;
    texto(s, a[clave], 900, y + 6, 480, alto - 12, {
      fontSize: pt(tam),
      color: GRIS,
      fit: "shrink",
    });
  });
}

// ----------------------------------------------------------------- cierre

function cierre(p: PptxGenJS, r: Recursos) {
  const s = p.addSlide();
  s.background = { color: BLANCO };
  if (r.redondeados.cierre) {
    colocar(s, r.redondeados.cierre, 200, 145, 1069, 528);
  } else {
    caja(s, 200, 145, 1069, 528, ROSA, { radio: 90 });
  }
  texto(s, "MUCHAS GRACIAS", 200, 145, 1069, 528, {
    fontSize: pt(54),
    bold: true,
    color: BLANCO,
    align: "center",
    valign: "middle",
  });
  logo(s, r, 1191, 703, 193, 75);
}

// ------------------------------------------------------------------ armado

/** Las imagenes de todo el informe, cargadas en paralelo. */
async function cargarRecursos(d: DatosInforme): Promise<Recursos> {
  const FONDO = "publico:img/informe-fondo.jpg";
  const [logoImg, fondo, portadaR, tarjeta, inversionR, cierreR] = await Promise.all([
    cargarImagen("publico:img/logo.png", 600),
    cargarImagen(FONDO, 1400),
    recorteRedondeado(FONDO, 580, 560, 22),
    recorteRedondeado(FONDO, 326, 146, 22),
    recorteRedondeado(FONDO, 409, 245, 22),
    recorteRedondeado(FONDO, 1069, 528, 90),
  ]);
  const fotos = new Map<string, ImagenInforme | null>();
  const portadas = new Map<string, ImagenInforme | null>();
  await Promise.all(
    d.influencers.flatMap((i) => [
      cargarImagen(i.foto, 600).then((img) => fotos.set(i.campaignProfileId, img)),
      ...i.piezas.map(async (pz, k) => {
        const origen = pz.miniatura ?? portadaDeRespaldo(pz.url);
        portadas.set(`${i.campaignProfileId}:${k}`, await cargarImagen(origen, 700));
      }),
    ]),
  );
  return {
    logo: logoImg,
    fondo,
    redondeados: { portada: portadaR, tarjeta, inversion: inversionR, cierre: cierreR },
    fotos,
    portadas,
  };
}

/**
 * Arma el PowerPoint y lo devuelve como Buffer.
 *
 * `analisisFinal` es el analisis ya resuelto: lo que mercadeo reescribio
 * y, donde no toco nada, la propuesta calculada con las cifras de hoy.
 */
export async function construirInforme(
  d: DatosInforme,
  analisisFinal: Analisis,
): Promise<Buffer> {
  const recursos = await cargarRecursos(d);
  const p = new PptxGenJS();
  p.layout = "LAYOUT_WIDE";
  p.title = `Informe de resultados · ${d.campana.nombre}`;
  p.company = "Los de Marketing";
  p.author = "Los de Marketing";

  // Las secciones se numeran segun las que salen: sin brief no hay
  // objetivos y el resumen pasa a ser la 01.
  let n = 0;
  const siguiente = () => String(++n).padStart(2, "0");

  portada(p, d, recursos);
  if (d.objetivos.length > 0) objetivos(p, d, siguiente());
  resumen(p, d, recursos, siguiente());
  const nIndividual = siguiente();
  d.influencers.forEach((i, k) =>
    individual(p, i, recursos, nIndividual, k + 1, d.influencers.length),
  );
  if (d.influencers.length > 0) {
    comparativo(p, d, siguiente());
    inversion(p, d, recursos, siguiente());
  }
  analisis(p, analisisFinal, recursos, siguiente());
  cierre(p, recursos);

  const salida = await p.write({ outputType: "nodebuffer" });
  return salida as Buffer;
}
