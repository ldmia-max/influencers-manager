/**
 * Lo que necesita el informe de resultados de una campana, ya calculado.
 *
 * Todo es serializable: lo arma el servidor, lo usa el generador del
 * PowerPoint y lo lee la pestana Informes para decir que va a salir.
 *
 * `null` en una cifra significa "nadie la publica" —un carrusel de
 * Instagram no tiene vistas, el alcance solo existe si alguien lo
 * anoto—, nunca cero. El informe pinta una raya, no un 0 que se leeria
 * como "nadie lo vio".
 */
export type Cifra = number | null;

export interface PiezaInforme {
  /** "Reel · Instagram". */
  etiqueta: string;
  url: string | null;
  /** Portada guardada en uploads, si el refresco de metricas la trajo. */
  miniatura: string | null;
  plataforma: string;
  vistas: Cifra;
  alcance: Cifra;
  meGusta: Cifra;
  comentarios: Cifra;
  esExtra: boolean;
}

export interface InfluencerInforme {
  campaignProfileId: string;
  nombre: string;
  ciudad: string | null;
  /** La cuenta contratada con mas seguidores: la que lo presenta. */
  usuario: string | null;
  urlPerfil: string | null;
  foto: string | null;
  seguidores: { red: string; valor: number }[];
  /** Redes contratadas, abreviadas: "IG", "TikTok", "YT". */
  redes: string[];
  /**
   * Lo que paga el cliente por el, con el margen. Null si ya no esta
   * contratado: se retiro, pero lo que publico sigue contando.
   */
  valor: number | null;
  publicaciones: number;
  vistas: Cifra;
  alcance: Cifra;
  meGusta: Cifra;
  comentarios: Cifra;
  piezas: PiezaInforme[];
}

export interface Objetivo {
  titulo: string;
  texto: string;
}

export const APARTADOS_ANALISIS = [
  { clave: "alcance", titulo: "Alcance" },
  { clave: "visibilidad", titulo: "Visibilidad" },
  { clave: "interaccion", titulo: "Interacción" },
  { clave: "desempeno", titulo: "Desempeño de perfiles" },
  { clave: "eficiencia", titulo: "Eficiencia de la inversión" },
] as const;

export type ClaveAnalisis = (typeof APARTADOS_ANALISIS)[number]["clave"];
export type Analisis = Record<ClaveAnalisis, string>;

export interface DatosInforme {
  campana: {
    id: string;
    nombre: string;
    cliente: string;
    /** "SEPTIEMBRE - OCTUBRE 2026". */
    periodo: string;
  };
  /** Del brief que origino la campana. Vacio si no hubo brief. */
  objetivos: Objetivo[];
  resumen: {
    vistas: Cifra;
    meGusta: Cifra;
    comentarios: Cifra;
    compartidos: Cifra;
    reposteos: Cifra;
    alcance: Cifra;
    /** Cuantas publicaciones tienen el alcance anotado. */
    piezasConAlcance: number;
    interacciones: number;
    engagement: Cifra;
    inversion: number;
    publicaciones: number;
    pactadas: number;
    previsionVistas: Cifra;
  };
  influencers: InfluencerInforme[];
  /** Dia de la ultima medicion, "DD/MM/AAAA". Null si no hay ninguna. */
  fechaDeCorte: string | null;
}
