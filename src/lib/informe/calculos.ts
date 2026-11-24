import { formatNumber } from "@/lib/format";
import type {
  Analisis,
  Cifra,
  DatosInforme,
  InfluencerInforme,
} from "./tipos";

/** 583668 → "583.668"; null → "—". */
export function miles(v: Cifra): string {
  if (v === null) return "—";
  const r = Math.round(v);
  return `${r < 0 ? "−" : ""}${formatNumber(Math.abs(r))}`;
}

/** 10010000 → "$10.010.000". */
export function pesos(v: Cifra): string {
  if (v === null) return "—";
  return `$${miles(v)}`;
}

/** 7.2 → "$7,20": los costos por vista son de centavos. */
export function pesosConDecimales(v: Cifra): string {
  if (v === null || !Number.isFinite(v)) return "—";
  const [entero, dec] = v.toFixed(2).split(".");
  return `$${formatNumber(entero)},${dec}`;
}

/** 4.93 → "4,9%". */
export function porcentaje(v: Cifra): string {
  if (v === null) return "—";
  return `${v.toFixed(1).replace(".", ",")}%`;
}

/** 3.998 → "4,0x". */
export function veces(v: Cifra): string {
  if (v === null) return "—";
  return `${v.toFixed(1).replace(".", ",")}x`;
}

/** Cuantas veces lo previsto. Null sin prevision o sin vistas. */
export function vecesLoPrevisto(d: DatosInforme): Cifra {
  const { vistas, previsionVistas } = d.resumen;
  if (vistas === null || !previsionVistas) return null;
  return vistas / previsionVistas;
}

/**
 * Costo por visualizacion: valor ÷ vistas. La formula es la de la
 * plantilla del informe y se escribe al pie de la diapositiva.
 */
export function cpv(i: InfluencerInforme): Cifra {
  if (i.valor === null || !i.vistas) return null;
  return i.valor / i.vistas;
}

/** Costo por interaccion: valor ÷ (likes + comentarios). */
export function cpe(i: InfluencerInforme): Cifra {
  if (i.valor === null) return null;
  const interacciones = (i.meGusta ?? 0) + (i.comentarios ?? 0);
  if (i.meGusta === null && i.comentarios === null) return null;
  if (interacciones === 0) return null;
  return i.valor / interacciones;
}

/** Los mismos dos costos para toda la campana. */
export function costosDeCampana(d: DatosInforme): { cpv: Cifra; cpe: Cifra } {
  // Solo de quien sigue contratado: un retirado no esta en la inversion,
  // y sumar sus vistas abarataria el costo con algo que no se pago.
  const pagados = d.influencers.filter((i) => i.valor !== null);
  const inversion = pagados.reduce((s, i) => s + (i.valor ?? 0), 0);
  const vistas = pagados.reduce((s, i) => s + (i.vistas ?? 0), 0);
  const inter = pagados.reduce(
    (s, i) => s + (i.meGusta ?? 0) + (i.comentarios ?? 0),
    0,
  );
  return {
    cpv: vistas > 0 ? inversion / vistas : null,
    cpe: inter > 0 ? inversion / inter : null,
  };
}

/** Quien tiene el menor valor de un costo, o null si nadie lo tiene. */
export function mejorEn(
  lista: InfluencerInforme[],
  costo: (i: InfluencerInforme) => Cifra,
): InfluencerInforme | null {
  let mejor: InfluencerInforme | null = null;
  let menor = Infinity;
  for (const i of lista) {
    const c = costo(i);
    if (c !== null && c < menor) {
      menor = c;
      mejor = i;
    }
  }
  return mejor;
}

/** Quien tiene la mayor cifra, o null si nadie la tiene. */
export function mayorEn(
  lista: InfluencerInforme[],
  cifra: (i: InfluencerInforme) => Cifra,
): InfluencerInforme | null {
  let mejor: InfluencerInforme | null = null;
  let mayor = -Infinity;
  for (const i of lista) {
    const c = cifra(i);
    if (c !== null && c > mayor) {
      mayor = c;
      mejor = i;
    }
  }
  return mejor;
}

/**
 * El analisis general que propone la app, escrito con las cifras reales.
 *
 * Solo afirma lo que dicen los datos. Los juicios —"un resultado muy
 * bueno, superior a lo normal"— no salen de aqui: dependen del sector y
 * de lo que se esperaba, y los escribe mercadeo sobre esta propuesta.
 * Un apartado sin datos lo dice, en vez de rellenarse.
 */
export function analisisPropuesto(d: DatosInforme): Analisis {
  const r = d.resumen;
  const nombre = d.campana.nombre;

  const alcance =
    r.alcance !== null
      ? `El contenido de ${nombre} llegó aproximadamente a ${miles(r.alcance)} cuentas únicas` +
        (r.piezasConAlcance < r.publicaciones
          ? `, según el alcance anotado en ${r.piezasConAlcance} de ${r.publicaciones} publicaciones.`
          : ".")
      : "No se anotó el alcance de ninguna publicación.";

  const factor = vecesLoPrevisto(d);
  const visibilidad =
    r.vistas === null
      ? "Todavía no hay visualizaciones medidas."
      : factor === null
        ? `Las publicaciones sumaron ${miles(r.vistas)} visualizaciones.`
        : `Se estimaban ${miles(r.previsionVistas)} visualizaciones y se obtuvieron ${miles(r.vistas)}: ` +
          (factor >= 1
            ? `${veces(factor).replace("x", "")} veces lo previsto.`
            : `el ${Math.round(factor * 100)}% de lo previsto.`);

  const interaccion =
    r.engagement === null
      ? "Sin alcance ni visualizaciones no se puede calcular el engagement."
      : `El engagement sobre el alcance fue de ${porcentaje(r.engagement)}, con ${miles(r.interacciones)} interacciones entre me gusta, comentarios, compartidos y reposteos.`;

  const conPiezas = d.influencers.filter((i) => i.publicaciones > 0);
  const masVistas = mayorEn(conPiezas, (i) => i.vistas);
  const masComentarios = mayorEn(conPiezas, (i) => i.comentarios);
  const partes = [
    `${conPiezas.length} ${conPiezas.length === 1 ? "creador publicó" : "creadores publicaron"} ${r.publicaciones} ${r.publicaciones === 1 ? "pieza" : "piezas"} de ${r.pactadas} ${r.pactadas === 1 ? "pactada" : "pactadas"}.`,
  ];
  if (masVistas) {
    partes.push(
      `${masVistas.nombre} generó más visualizaciones (${miles(masVistas.vistas)})` +
        (masComentarios && masComentarios !== masVistas
          ? ` y ${masComentarios.nombre} más comentarios (${miles(masComentarios.comentarios)}).`
          : masComentarios
            ? ` y más comentarios (${miles(masComentarios.comentarios)}).`
            : "."),
    );
  }
  const desempeno =
    conPiezas.length === 0
      ? "Todavía no hay publicaciones registradas."
      : partes.join(" ");

  const pagados = d.influencers.filter((i) => i.valor !== null);
  const mejorCpv = mejorEn(pagados, cpv);
  const mejorCpe = mejorEn(pagados, cpe);
  let eficiencia = `Con una inversión de ${pesos(r.inversion)}`;
  if (!mejorCpv && !mejorCpe) {
    eficiencia += " todavía no hay cifras para calcular el costo por visualización.";
  } else if (mejorCpv && mejorCpv === mejorCpe) {
    eficiencia += `, ${mejorCpv.nombre} fue el perfil más eficiente, con el menor costo por visualización (${pesosConDecimales(cpv(mejorCpv))}) y por interacción (${pesosConDecimales(cpe(mejorCpe))}).`;
  } else {
    const trozos: string[] = [];
    if (mejorCpv) {
      trozos.push(
        `${mejorCpv.nombre} logró el menor costo por visualización (${pesosConDecimales(cpv(mejorCpv))})`,
      );
    }
    if (mejorCpe) {
      trozos.push(
        `${mejorCpe.nombre} el menor costo por interacción (${pesosConDecimales(cpe(mejorCpe))})`,
      );
    }
    eficiencia += `, ${trozos.join(" y ")}.`;
  }

  return { alcance, visibilidad, interaccion, desempeno, eficiencia };
}
