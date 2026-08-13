import { z } from "zod";

/**
 * Validacion del brief publico de campana (/brief).
 *
 * Los campos obligatorios son los acordados con el equipo de cuenta.
 * Todo lo demas es opcional: el brief es una tabla de recepcion, no una
 * campana, y se prefiere recibir informacion parcial a perder el envio.
 */

// Campo de texto opcional: normaliza "" y espacios a undefined
const opcional = z
  .string()
  .trim()
  .max(5000, "Maximo 5000 caracteres")
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const obligatorio = (campo: string, max = 5000) =>
  z.string().trim().min(1, `${campo} es obligatorio`).max(max);

const fecha = (campo: string) =>
  z
    .string()
    .min(1, `${campo} es obligatoria`)
    .refine((v) => !Number.isNaN(Date.parse(v)), `${campo} no es una fecha valida`);

export const creadorSugeridoSchema = z.object({
  nombre: z.string().trim().max(200),
  linkPerfil: z.string().trim().max(500),
});

export const briefSchema = z
  .object({
    // ---------- 01 Datos de contacto ----------
    empresa: obligatorio("La empresa o marca", 200),
    responsable: obligatorio("El responsable del proyecto", 200),
    cargo: obligatorio("El cargo", 150),
    correo: z.string().trim().email("El correo no es valido").max(200),
    telefono: obligatorio("El telefono", 50),
    apruebaContenidos: opcional,
    tiempoRespuesta: opcional,

    // ---------- 02 Resumen de la campana ----------
    nombreCampana: obligatorio("El nombre de la campana", 200),
    descripcionProducto: obligatorio("La descripcion del producto o servicio"),
    objetivoPrincipal: obligatorio("El objetivo principal", 100),
    objetivoOtro: opcional,
    fechaInicio: fecha("La fecha de inicio"),
    fechaFinal: fecha("La fecha final"),
    fechaPublicacion: fecha("La fecha de publicacion de contenido"),
    fechasClave: obligatorio("Las fechas clave inamovibles"),
    presupuestoTotal: z
      .string()
      .min(1, "El presupuesto total es obligatorio")
      .refine((v) => Number(v) > 0, "El presupuesto debe ser mayor que cero"),
    moneda: z.string().trim().default("COP"),
    incluyePauta: z.enum(["SI", "NO", "POR_DEFINIR"], {
      message: "Indica si incluye pauta o amplificacion pagada",
    }),
    pautaDias: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => {
        if (v === undefined || v === "") return undefined;
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
      }),
    kpis: opcional,
    campanasPrevias: opcional,

    // ---------- 03 Producto o servicio ----------
    queSePromociona: z
      .array(z.string())
      .min(1, "Indica que se promociona"),
    precioYCompra: obligatorio("El precio y donde se compra o contrata"),
    territorioPromocion: obligatorio("El territorio de promocion"),
    publicoObjetivo: obligatorio("El publico objetivo"),
    enviaMuestra: opcional,
    problemaResuelve: opcional,
    atributos: z.array(z.string().trim()).default([]),
    competidores: opcional,

    // ---------- 04 Mensajes y comunicacion ----------
    claimsObligatorios: obligatorio("Las frases o claims que deben decirse"),
    claimsProhibidos: obligatorio("Las frases o claims prohibidos"),
    libertadCreativa: z.enum(["TOTAL", "PARCIAL", "GUION_CERRADO"], {
      message: "Indica el nivel de libertad creativa del creador",
    }),
    datosDuros: opcional,
    temasSensibles: opcional,
    tono: z.array(z.string()).default([]),

    // ---------- 05 Enlaces y menciones ----------
    landingUrl: opcional,
    usuariosEtiquetar: obligatorio("Los usuarios a etiquetar"),
    hashtags: opcional,
    appYTienda: opcional,
    codigoDescuento: opcional,

    // ---------- 06 Creadores de contenido ----------
    creadoresSugeridos: z.array(creadorSugeridoSchema).default([]),
    nichos: z.array(z.string()).min(1, "Selecciona al menos un nicho o categoria"),
    plataformas: z.array(z.string()).default([]),
    tamanoAudiencia: opcional,
    cantidadCreadores: opcional,
    ciudadPaisCreador: opcional,
    perfilDemografico: opcional,
    presenciaFisica: opcional,
    creadoresVetados: opcional,
    marcasVetadas: opcional,

    // ---------- 07 Condiciones legales y de uso ----------
    colaboracionConMarca: z.enum(["SI", "NO"], {
      message: "Indica si el contenido estara en colaboracion con la marca",
    }),
    etiquetaPublicidad: z.array(z.string()).default([]),
    exclusividad: opcional,
    permanenciaContenido: opcional,
    restriccionesLegales: opcional,

    // ---------- 09 Referencias ----------
    referenciasGustan: opcional,
    referenciasNoGustan: opcional,
    comentarios: opcional,
  })
  .refine(
    (d) => new Date(d.fechaFinal) >= new Date(d.fechaInicio),
    { message: "La fecha final no puede ser anterior a la de inicio", path: ["fechaFinal"] }
  )
  .refine(
    (d) => d.incluyePauta !== "SI" || d.pautaDias !== undefined,
    { message: "Indica cuantos dias de pauta", path: ["pautaDias"] }
  );

export type BriefInput = z.input<typeof briefSchema>;
export type BriefData = z.output<typeof briefSchema>;
