"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { PriceInput } from "@/components/ui/price-input";
import {
  MAX_ARCHIVOS,
  MAX_BYTES,
  MAX_BYTES_TOTAL,
  EXTENSIONES_VISIBLES,
  formatearPeso,
  tipoPermitido,
  nombreSeguro,
} from "@/lib/brief-documentos";
import { CheckCircle2, AlertCircle, Paperclip, X } from "lucide-react";
import {
  Seccion,
  Campo,
  CampoTexto,
  CampoArea,
  GrupoCheck,
  GrupoRadio,
} from "./brief-fields";

const FILAS_CREADORES = 5;
const FILAS_ATRIBUTOS = 5;

const estadoInicial = {
  // 01
  empresa: "", responsable: "", cargo: "", correo: "", telefono: "",
  apruebaContenidos: "", tiempoRespuesta: "",
  // 02
  nombreCampana: "", descripcionProducto: "", objetivoPrincipal: "", objetivoOtro: "",
  fechaInicio: "", fechaFinal: "", fechaPublicacion: "", fechasClave: "",
  presupuestoTotal: "", incluyePauta: "", pautaDias: "", kpis: "", campanasPrevias: "",
  // 03
  queSePromociona: [] as string[], precioYCompra: "", territorioPromocion: "",
  publicoObjetivo: "", enviaMuestra: "", problemaResuelve: "",
  atributos: Array(FILAS_ATRIBUTOS).fill("") as string[], competidores: "",
  // 04
  claimsObligatorios: "", claimsProhibidos: "", libertadCreativa: "",
  datosDuros: "", temasSensibles: "", tono: [] as string[],
  // 05
  landingUrl: "", usuariosEtiquetar: "", hashtags: "", appYTienda: "", codigoDescuento: "",
  // 06
  creadoresSugeridos: Array.from({ length: FILAS_CREADORES }, () => ({ nombre: "", linkPerfil: "" })),
  nichos: [] as string[], plataformas: [] as string[], tamanoAudiencia: "",
  cantidadCreadores: "", ciudadPaisCreador: "", perfilDemografico: "",
  presenciaFisica: "", creadoresVetados: "", marcasVetadas: "",
  // 07
  colaboracionConMarca: "", etiquetaPublicidad: [] as string[], exclusividad: "",
  permanenciaContenido: "", restriccionesLegales: "",
  // 09
  referenciasGustan: "", referenciasNoGustan: "", comentarios: "",
};

type Estado = typeof estadoInicial;

export function BriefForm({
  nichos,
  blobHabilitado = false,
}: {
  nichos: MultiSelectOption[];
  /** true en Vercel: los adjuntos se suben directos a Blob desde aqui */
  blobHabilitado?: boolean;
}) {
  const [d, setD] = useState<Estado>(estadoInicial);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState("");
  const [errorArchivos, setErrorArchivos] = useState("");
  const [errorGeneral, setErrorGeneral] = useState("");
  const [enviado, setEnviado] = useState(false);

  const set = <K extends keyof Estado>(campo: K, valor: Estado[K]) => {
    setD((prev) => ({ ...prev, [campo]: valor }));
    setErrores((prev) => {
      if (!prev[campo as string]) return prev;
      const copia = { ...prev };
      delete copia[campo as string];
      return copia;
    });
  };

  const pesoTotal = archivos.reduce((suma, a) => suma + a.size, 0);

  const setCreador = (i: number, campo: "nombre" | "linkPerfil", valor: string) =>
    setD((prev) => {
      const filas = [...prev.creadoresSugeridos];
      filas[i] = { ...filas[i], [campo]: valor };
      return { ...prev, creadoresSugeridos: filas };
    });

  const setAtributo = (i: number, valor: string) =>
    setD((prev) => {
      const filas = [...prev.atributos];
      filas[i] = valor;
      return { ...prev, atributos: filas };
    });

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErrores({});
    setErrorGeneral("");

    const payload = {
      ...d,
      moneda: "COP",
      atributos: d.atributos.filter((a) => a.trim()),
      creadoresSugeridos: d.creadoresSugeridos.filter(
        (c) => c.nombre.trim() || c.linkPerfil.trim()
      ),
    };

    const alInicio = () => window.scrollTo({ top: 0, behavior: "smooth" });

    try {
      const formData = new FormData();
      formData.append("data", JSON.stringify(payload));

      if (blobHabilitado && archivos.length > 0) {
        // Los archivos van del navegador a Blob directamente. Si se
        // enviaran dentro de este POST, Vercel cortaria la peticion con
        // HTTP 413 al superar 4.5 MB.
        const { upload } = await import("@vercel/blob/client");
        const carpeta = crypto.randomUUID();
        const subidos = [];

        for (const [i, archivo] of archivos.entries()) {
          setProgreso(`Subiendo archivo ${i + 1} de ${archivos.length}…`);
          const blob = await upload(
            `briefs/${carpeta}/${nombreSeguro(archivo.name)}`,
            archivo,
            { access: "public", handleUploadUrl: "/api/public/brief/upload" }
          );
          subidos.push({
            nombre: archivo.name,
            url: blob.url,
            tamano: archivo.size,
            tipo: archivo.type || "desconocido",
          });
        }
        formData.append("documentosSubidos", JSON.stringify(subidos));
      } else {
        archivos.forEach((a) => formData.append("documentos", a));
      }

      setProgreso("Enviando el brief…");
      const res = await fetch("/api/public/brief", { method: "POST", body: formData });

      // Un 413 o un error de plataforma no devuelve JSON: sin esto, el
      // .json() lanzaba y el usuario no veia ningun mensaje.
      let json: { error?: string; details?: { path: string; message: string }[] } = {};
      try {
        json = await res.json();
      } catch {
        json = {};
      }

      if (!res.ok) {
        if (Array.isArray(json.details)) {
          const mapa: Record<string, string> = {};
          for (const det of json.details) mapa[det.path] = det.message;
          setErrores(mapa);
        }
        setErrorGeneral(
          json.error ??
            (res.status === 413
              ? "Los archivos adjuntos son demasiado grandes. Prueba con menos archivos o más ligeros."
              : `No se pudo enviar el brief (error ${res.status}).`)
        );
        alInicio();
        return;
      }

      setEnviado(true);
      alInicio();
    } catch (err) {
      setErrorGeneral(
        err instanceof Error && err.message
          ? `No se pudo enviar el brief: ${err.message}`
          : "Error de conexión. Revisa tu red e intenta de nuevo."
      );
      alInicio();
    } finally {
      setEnviando(false);
      setProgreso("");
    }
  }

  if (enviado) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-10 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" />
        <h2 className="mt-5 text-2xl font-bold text-gray-900">
          ¡Brief recibido!
        </h2>
        <p className="mx-auto mt-3 max-w-md text-gray-600">
          Gracias por completarlo. Nuestro equipo de cuenta lo revisará y se
          pondrá en contacto contigo al correo <strong>{d.correo}</strong>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-8">
      {errorGeneral && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="font-medium text-red-800">{errorGeneral}</p>
            {Object.keys(errores).length > 0 && (
              <p className="mt-1 text-sm text-red-700">
                Revisa los campos marcados en rojo más abajo.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ---------- 01 ---------- */}
      <Seccion numero="01" titulo="Datos de contacto">
        <CampoTexto label="Empresa / Marca" required value={d.empresa}
          onChange={(v) => set("empresa", v)} error={errores.empresa} />
        <CampoTexto label="Responsable del proyecto" required value={d.responsable}
          onChange={(v) => set("responsable", v)} error={errores.responsable} />
        <CampoTexto label="Cargo" required value={d.cargo}
          onChange={(v) => set("cargo", v)} error={errores.cargo} />
        <div className="grid gap-6 sm:grid-cols-2">
          <CampoTexto label="Correo" required type="email" value={d.correo}
            onChange={(v) => set("correo", v)} error={errores.correo} />
          <CampoTexto label="Teléfono" required value={d.telefono}
            onChange={(v) => set("telefono", v)} error={errores.telefono} />
        </div>
        <CampoTexto label="Quién aprueba contenidos" value={d.apruebaContenidos}
          onChange={(v) => set("apruebaContenidos", v)} />
        <GrupoRadio label="Tiempo de respuesta para aprobaciones" name="tiempoRespuesta"
          valor={d.tiempoRespuesta} onChange={(v) => set("tiempoRespuesta", v)}
          opciones={[
            { value: "24h", label: "24 h" },
            { value: "48h", label: "48 h" },
            { value: "72h", label: "72 h" },
          ]} />
      </Seccion>

      {/* ---------- 02 ---------- */}
      <Seccion numero="02" titulo="Resumen de la campaña">
        <CampoTexto label="Nombre de la campaña" required value={d.nombreCampana}
          onChange={(v) => set("nombreCampana", v)} error={errores.nombreCampana} />
        <CampoArea label="Breve descripción de la campaña, producto o servicio" required
          value={d.descripcionProducto} onChange={(v) => set("descripcionProducto", v)}
          error={errores.descripcionProducto} />
        <GrupoRadio label="Objetivo principal" required name="objetivo"
          valor={d.objetivoPrincipal} onChange={(v) => set("objetivoPrincipal", v)}
          error={errores.objetivoPrincipal}
          opciones={[
            { value: "Reconocimiento", label: "Reconocimiento" },
            { value: "Consideración", label: "Consideración" },
            { value: "Tráfico", label: "Tráfico" },
            { value: "Descargas", label: "Descargas" },
            { value: "Ventas / conversión", label: "Ventas / conversión" },
            { value: "Lanzamiento", label: "Lanzamiento" },
            { value: "Otro", label: "Otro" },
          ]} />
        {d.objetivoPrincipal === "Otro" && (
          <CampoTexto label="¿Cuál otro objetivo?" value={d.objetivoOtro}
            onChange={(v) => set("objetivoOtro", v)} />
        )}
        <div className="grid gap-6 sm:grid-cols-3">
          <CampoTexto label="Fecha de inscripción de campaña" required type="date" value={d.fechaInicio}
            onChange={(v) => set("fechaInicio", v)} error={errores.fechaInicio} />
          <CampoTexto label="Fecha final" required type="date" value={d.fechaFinal}
            onChange={(v) => set("fechaFinal", v)} error={errores.fechaFinal} />
          <CampoTexto label="Fecha de inicio de publicaciones" required type="date"
            value={d.fechaPublicacion} onChange={(v) => set("fechaPublicacion", v)}
            error={errores.fechaPublicacion} />
        </div>
        <CampoArea label="Fechas clave inamovibles" required rows={2}
          hint="Lanzamiento, evento, promoción…" value={d.fechasClave}
          onChange={(v) => set("fechasClave", v)} error={errores.fechasClave} />
        <Campo label="Presupuesto total aprobado" required error={errores.presupuestoTotal}
          hint="Valor en pesos colombianos (COP)">
          <PriceInput value={d.presupuestoTotal}
            onChange={(v) => set("presupuestoTotal", v)} placeholder="0" />
        </Campo>
        <GrupoRadio label="¿Incluye pauta / amplificación pagada?" required name="pauta"
          valor={d.incluyePauta} onChange={(v) => set("incluyePauta", v)}
          error={errores.incluyePauta}
          opciones={[
            { value: "SI", label: "Sí" },
            { value: "NO", label: "No" },
            { value: "POR_DEFINIR", label: "Por definir" },
          ]} />
        {d.incluyePauta === "SI" && (
          <Campo label="¿Cuánto tiempo?" required error={errores.pautaDias}>
            <div className="flex items-center gap-2">
              <Input type="number" min={1} value={d.pautaDias}
                onChange={(e) => set("pautaDias", e.target.value)}
                className="max-w-32" placeholder="0" />
              <span className="text-sm text-gray-600">días</span>
            </div>
          </Campo>
        )}
        <CampoArea label="KPI con los que se medirá el éxito" value={d.kpis}
          onChange={(v) => set("kpis", v)} />
        <CampoArea label="¿Hay campañas previas? ¿Qué funcionó y qué no?"
          value={d.campanasPrevias} onChange={(v) => set("campanasPrevias", v)} />
      </Seccion>

      {/* ---------- 03 ---------- */}
      <Seccion numero="03" titulo="Producto o servicio a promocionar">
        <GrupoCheck label="¿Qué se promociona?" required
          seleccion={d.queSePromociona} onChange={(v) => set("queSePromociona", v)}
          error={errores.queSePromociona}
          opciones={["Producto físico", "Producto digital / App", "Servicio", "Evento", "Marca (institucional)"]} />
        <CampoArea label="Precio y dónde se compra / contrata" required rows={2}
          value={d.precioYCompra} onChange={(v) => set("precioYCompra", v)}
          error={errores.precioYCompra} />
        <CampoArea label="Territorio de promoción" required rows={2}
          hint="País – Ciudad" value={d.territorioPromocion}
          onChange={(v) => set("territorioPromocion", v)} error={errores.territorioPromocion} />
        <CampoArea label="Público objetivo" required
          hint="Edad, género, ubicación, intereses, momento de vida"
          value={d.publicoObjetivo} onChange={(v) => set("publicoObjetivo", v)}
          error={errores.publicoObjetivo} />
        <CampoTexto label="¿Se enviará muestra o acceso al creador?" value={d.enviaMuestra}
          onChange={(v) => set("enviaMuestra", v)} />
        <CampoArea label="Problema que resuelve para ese público" value={d.problemaResuelve}
          onChange={(v) => set("problemaResuelve", v)} />
        <Campo label="Atributos del producto / servicio"
          hint="¿Qué te hace único y/o diferente?">
          <div className="space-y-2">
            {d.atributos.map((a, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-5 text-sm text-gray-400">{i + 1}</span>
                <Input value={a} onChange={(e) => setAtributo(i, e.target.value)} />
              </div>
            ))}
          </div>
        </Campo>
        <CampoArea label="Competidores directos" rows={2}
          hint="Para evitar comparaciones o creadores en conflicto"
          value={d.competidores} onChange={(v) => set("competidores", v)} />
      </Seccion>

      {/* ---------- 04 ---------- */}
      <Seccion numero="04" titulo="Mensajes y comunicación">
        <CampoArea label="Frases / claims que deben decirse textualmente" required
          value={d.claimsObligatorios} onChange={(v) => set("claimsObligatorios", v)}
          error={errores.claimsObligatorios} />
        <CampoArea label="Frases / claims prohibidos" required
          hint="Legales, promesas, superlativos" value={d.claimsProhibidos}
          onChange={(v) => set("claimsProhibidos", v)} error={errores.claimsProhibidos} />
        <GrupoRadio label="¿El creador puede usar su propio lenguaje / estilo?" required
          name="libertad" valor={d.libertadCreativa}
          onChange={(v) => set("libertadCreativa", v)} error={errores.libertadCreativa}
          opciones={[
            { value: "TOTAL", label: "Total" },
            { value: "PARCIAL", label: "Parcial" },
            { value: "GUION_CERRADO", label: "Guion cerrado" },
          ]} />
        <CampoArea label="Datos importantes a mencionar" rows={2}
          hint="Cifras, certificaciones, respaldos" value={d.datosDuros}
          onChange={(v) => set("datosDuros", v)} />
        <CampoArea label="Temas sensibles a evitar" rows={2} value={d.temasSensibles}
          onChange={(v) => set("temasSensibles", v)} />
        <GrupoCheck label="Tono de comunicación" seleccion={d.tono}
          onChange={(v) => set("tono", v)}
          opciones={["Cercano", "Divertido", "Aspiracional", "Educativo", "Profesional"]} />
      </Seccion>

      {/* ---------- 05 ---------- */}
      <Seccion numero="05" titulo="Enlaces y menciones">
        <CampoTexto label="URL / Landing page" placeholder="https://"
          value={d.landingUrl} onChange={(v) => set("landingUrl", v)}
          error={errores.landingUrl} />
        <CampoArea label="@Usuarios a etiquetar" required rows={2}
          hint="Indica el usuario por cada plataforma" value={d.usuariosEtiquetar}
          onChange={(v) => set("usuariosEtiquetar", v)} error={errores.usuariosEtiquetar} />
        <CampoArea label="Hashtags" rows={2} value={d.hashtags}
          onChange={(v) => set("hashtags", v)} />
        <CampoTexto label="App: nombre exacto y tienda"
          hint="App Store / Google Play" value={d.appYTienda}
          onChange={(v) => set("appYTienda", v)} />
        <CampoTexto label="Código de descuento / cupón" value={d.codigoDescuento}
          onChange={(v) => set("codigoDescuento", v)} />
      </Seccion>

      {/* ---------- 06 ---------- */}
      <Seccion numero="06" titulo="Creadores de contenido">
        <Campo label="6.1 · Creadores sugeridos por la marca"
          hint="Opcional. Si aún no hay nombres definidos, completa el perfil ideal.">
          <div className="space-y-2">
            {d.creadoresSugeridos.map((c, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-2">
                <Input placeholder={`Nombre / usuario ${i + 1}`} value={c.nombre}
                  onChange={(e) => setCreador(i, "nombre", e.target.value)} />
                <Input placeholder="Link de perfil" value={c.linkPerfil}
                  onChange={(e) => setCreador(i, "linkPerfil", e.target.value)} />
              </div>
            ))}
          </div>
        </Campo>

        <div className="border-t border-gray-100 pt-6">
          <p className="mb-6 text-sm font-medium text-gray-900">6.2 · Perfil ideal</p>
          <div className="space-y-6">
            <Campo label="Nichos / categorías de contenido" required
              hint="Puedes elegir varias" error={errores.nichos}>
              <MultiSelect options={nichos} selected={d.nichos}
                onChange={(v) => set("nichos", v)}
                placeholder="Selecciona los nichos" />
            </Campo>
            <GrupoCheck label="Plataformas prioritarias" seleccion={d.plataformas}
              onChange={(v) => set("plataformas", v)}
              opciones={["Instagram", "TikTok", "YouTube", "Twitch", "LinkedIn", "Podcast"]} />
            <GrupoRadio label="Tamaño de audiencia deseado" name="audiencia"
              valor={d.tamanoAudiencia} onChange={(v) => set("tamanoAudiencia", v)}
              opciones={[
                { value: "Nano (1K–10K)", label: "Nano (1K–10K)" },
                { value: "Micro (10K–100K)", label: "Micro (10K–100K)" },
                { value: "Macro (100K–1M)", label: "Macro (100K–1M)" },
                { value: "Celebridad (+1M)", label: "Celebridad (+1M)" },
                { value: "Mix", label: "Mix" },
              ]} />
            <CampoTexto label="Cantidad estimada de creadores" value={d.cantidadCreadores}
              onChange={(v) => set("cantidadCreadores", v)} />
            <CampoTexto label="Ciudad o país del creador" value={d.ciudadPaisCreador}
              onChange={(v) => set("ciudadPaisCreador", v)} />
            <CampoTexto label="Perfil demográfico del creador" hint="Edad, género"
              value={d.perfilDemografico} onChange={(v) => set("perfilDemografico", v)} />
            <CampoTexto label="¿Se requiere presencia física?"
              hint="Evento, visita, locación" value={d.presenciaFisica}
              onChange={(v) => set("presenciaFisica", v)} />
            <CampoArea label="Creadores vetados" rows={2} hint="No trabajar con ellos"
              value={d.creadoresVetados} onChange={(v) => set("creadoresVetados", v)} />
            <CampoArea label="Marcas con las que el creador NO puede tener relación vigente"
              rows={2} value={d.marcasVetadas} onChange={(v) => set("marcasVetadas", v)} />
          </div>
        </div>
      </Seccion>

      {/* ---------- 07 ---------- */}
      <Seccion numero="07" titulo="Condiciones legales y de uso">
        <GrupoRadio label="¿El contenido estará en colaboración con la marca?" required
          name="colaboracion" valor={d.colaboracionConMarca}
          onChange={(v) => set("colaboracionConMarca", v)}
          error={errores.colaboracionConMarca}
          opciones={[{ value: "SI", label: "Sí" }, { value: "NO", label: "No" }]} />
        <GrupoCheck label="Etiqueta de publicidad requerida"
          seleccion={d.etiquetaPublicidad} onChange={(v) => set("etiquetaPublicidad", v)}
          opciones={["#Publicidad", "#Ad", "Herramienta nativa de la plataforma"]} />
        <CampoTexto label="Exclusividad de categoría exigida al creador"
          hint="Indica la duración si aplica" value={d.exclusividad}
          onChange={(v) => set("exclusividad", v)} />
        <CampoTexto label="¿El contenido debe permanecer publicado?"
          hint="Indica el tiempo mínimo si aplica" value={d.permanenciaContenido}
          onChange={(v) => set("permanenciaContenido", v)} />
        <CampoArea label="Restricciones legales del sector" rows={2}
          hint="Salud, financiero, alcohol…" value={d.restriccionesLegales}
          onChange={(v) => set("restriccionesLegales", v)} />
      </Seccion>

      {/* ---------- 08 ---------- */}
      <Seccion numero="08" titulo="Documentos adjuntos">
        <p className="text-sm text-gray-600">
          Puedes adjuntar el material de apoyo que tengas disponible: brochure o
          catálogo, manual de marca (logos, colores, tipografías), fotos y videos
          del producto, brief de campaña previo o interno, guion o storyboard
          sugerido, y fichas técnicas o certificaciones.
        </p>
        <Campo label="Archivos"
          hint={`Hasta ${MAX_ARCHIVOS} archivos de ${formatearPeso(MAX_BYTES)} cada uno, y ${formatearPeso(MAX_BYTES_TOTAL)} entre todos. Formatos: ${EXTENSIONES_VISIBLES}.`}>
          <div className="space-y-3">
            <Label
              htmlFor="documentos"
              className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-8 text-sm text-gray-600 transition-colors hover:border-[#E1145F] hover:text-[#E1145F]"
            >
              <Paperclip className="h-4 w-4" />
              Haz clic para seleccionar archivos
            </Label>
            <input
              id="documentos"
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const nuevos = Array.from(e.target.files ?? []);
                const rechazados: string[] = [];

                setArchivos((prev) => {
                  let acumulado = prev.reduce((s, a) => s + a.size, 0);
                  const aceptados = [...prev];

                  for (const a of nuevos) {
                    if (aceptados.length >= MAX_ARCHIVOS) {
                      rechazados.push(
                        `Solo se admiten ${MAX_ARCHIVOS} archivos: «${a.name}» no se añadió`
                      );
                      continue;
                    }
                    if (a.size > MAX_BYTES) {
                      rechazados.push(
                        `«${a.name}» pesa ${formatearPeso(a.size)} y el máximo por archivo es ${formatearPeso(MAX_BYTES)}`
                      );
                      continue;
                    }
                    if (a.type && !tipoPermitido(a.type)) {
                      rechazados.push(`«${a.name}» no es un formato admitido`);
                      continue;
                    }
                    if (acumulado + a.size > MAX_BYTES_TOTAL) {
                      rechazados.push(
                        `Se superaría el límite total: «${a.name}» (${formatearPeso(a.size)}) elevaría los adjuntos a ${formatearPeso(acumulado + a.size)}, y el máximo entre todos es ${formatearPeso(MAX_BYTES_TOTAL)}`
                      );
                      continue;
                    }
                    aceptados.push(a);
                    acumulado += a.size;
                  }

                  return aceptados;
                });

                setErrorArchivos(rechazados.join(". "));
                e.target.value = "";
              }}
            />

            {/* Alerta visible aqui mismo: el usuario esta mirando esta
                zona cuando elige archivos, no la cabecera de la pagina */}
            {errorArchivos && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4"
              >
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <div className="text-sm">
                  <p className="font-semibold text-red-800">
                    No se pudieron añadir algunos archivos
                  </p>
                  <p className="mt-1 text-red-700">{errorArchivos}</p>
                </div>
                <button
                  type="button"
                  aria-label="Cerrar aviso"
                  onClick={() => setErrorArchivos("")}
                  className="ml-auto shrink-0 text-red-400 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {archivos.length > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">
                  {archivos.length} de {MAX_ARCHIVOS} archivos
                </span>
                <span
                  className={
                    pesoTotal > MAX_BYTES_TOTAL * 0.9
                      ? "font-medium text-amber-600"
                      : "text-gray-500"
                  }
                >
                  {formatearPeso(pesoTotal)} de {formatearPeso(MAX_BYTES_TOTAL)}
                </span>
              </div>
            )}

            {archivos.length > 0 && (
              <ul className="space-y-2">
                {archivos.map((a, i) => (
                  <li key={i}
                    className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                    <span className="truncate text-gray-700">
                      {a.name}{" "}
                      <span className="text-gray-400">
                        ({(a.size / 1024).toFixed(0)} KB)
                      </span>
                    </span>
                    <button type="button" aria-label={`Quitar ${a.name}`}
                      onClick={() => setArchivos((p) => p.filter((_, j) => j !== i))}
                      className="ml-3 shrink-0 text-gray-400 hover:text-red-600">
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Campo>
      </Seccion>

      {/* ---------- 09 ---------- */}
      <Seccion numero="09" titulo="Referencias">
        <CampoArea label="Referencias de contenido que les gustan" hint="Enlaces"
          value={d.referenciasGustan} onChange={(v) => set("referenciasGustan", v)} />
        <CampoArea label="Referencias de lo que no quieren"
          value={d.referenciasNoGustan} onChange={(v) => set("referenciasNoGustan", v)} />
        <CampoArea label="Comentarios adicionales" value={d.comentarios}
          onChange={(v) => set("comentarios", v)} />
      </Seccion>

      <div className="flex flex-col items-center gap-3 pb-4">
        <Button type="submit" disabled={enviando} size="lg"
          className="w-full bg-[#E1145F] hover:bg-[#C1104F] sm:w-auto sm:px-12">
          {enviando ? progreso || "Enviando…" : "Enviar brief"}
        </Button>
        <p className="text-xs text-gray-500">
          Al enviar, tus datos quedan registrados para la preparación de la campaña.
        </p>
      </div>
    </form>
  );
}
