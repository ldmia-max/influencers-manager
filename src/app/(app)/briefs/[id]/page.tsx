import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCampaignBriefById } from "@/data-access/campaign-briefs";
import type { DocumentoAdjunto } from "@/data-access/campaign-briefs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ESTADO_BRIEF } from "@/components/briefs/estado-brief";
import { BriefActions } from "@/components/briefs/brief-actions";
import { ArrowLeft, Paperclip, Download } from "lucide-react";

export const metadata = { title: "Detalle del brief" };

export default async function BriefDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <Link href="/briefs"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" />
        Volver a briefs
      </Link>

      <Suspense fallback={<p className="text-sm text-gray-500">Cargando…</p>}>
        <Detalle id={id} />
      </Suspense>
    </div>
  );
}

// -- Bloques de presentacion --------------------------------------------

function Dato({ label, valor }: { label: string; valor?: string | null }) {
  if (!valor) return null;
  return (
    <div className="py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{valor}</dd>
    </div>
  );
}

function Lista({ label, valores }: { label: string; valores: string[] }) {
  if (!valores?.length) return null;
  return (
    <div className="py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="mt-2 flex flex-wrap gap-1.5">
        {valores.map((v) => (
          <Badge key={v} variant="secondary">{v}</Badge>
        ))}
      </dd>
    </div>
  );
}

function Bloque({ numero, titulo, children }: {
  numero: string; titulo: string; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-baseline gap-3 text-base">
          <span className="text-[#E1145F]">{numero}</span>
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-gray-100">{children}</dl>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------

async function Detalle({ id }: { id: string }) {
  // Comprobacion propia, NO delegada al layout: con Cache Components el
  // redirect del layout vive en otro Suspense y este contenido se
  // transmitiria igualmente al cliente sin sesion.
  const session = await auth();
  if (!session?.user) redirect("/login");

  const b = await getCampaignBriefById(id);
  if (!b) notFound();

  const estado = ESTADO_BRIEF[b.status];
  const fecha = (d: Date | null) =>
    d ? new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(d) : null;
  const cop = (v: unknown) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency", currency: "COP", maximumFractionDigits: 0,
    }).format(Number(v));

  const documentos = (b.documentos as unknown as DocumentoAdjunto[] | null) ?? [];
  const creadores =
    (b.creadoresSugeridos as unknown as { nombre: string; linkPerfil: string }[] | null) ?? [];

  const pauta =
    b.incluyePauta === "SI"
      ? `Sí${b.pautaDias ? ` — ${b.pautaDias} días` : ""}`
      : b.incluyePauta === "NO"
      ? "No"
      : "Por definir";

  const libertad = { TOTAL: "Total", PARCIAL: "Parcial", GUION_CERRADO: "Guion cerrado" }[
    b.libertadCreativa
  ];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{b.nombreCampana}</h1>
            <Badge variant={estado.variant}>{estado.label}</Badge>
          </div>
          <p className="mt-1 text-gray-500">
            {b.empresa} · recibido el {fecha(b.createdAt)}
          </p>
        </div>
        <BriefActions briefId={b.id} status={b.status} campaignId={b.campaignId} />
      </div>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-2">
        <Bloque numero="01" titulo="Datos de contacto">
          <Dato label="Empresa / Marca" valor={b.empresa} />
          <Dato label="Responsable" valor={`${b.responsable} — ${b.cargo}`} />
          <Dato label="Correo" valor={b.correo} />
          <Dato label="Teléfono" valor={b.telefono} />
          <Dato label="Quién aprueba contenidos" valor={b.apruebaContenidos} />
          <Dato label="Tiempo de respuesta" valor={b.tiempoRespuesta} />
        </Bloque>

        <Bloque numero="02" titulo="Resumen de la campaña">
          <Dato label="Descripción" valor={b.descripcionProducto} />
          <Dato label="Objetivo principal"
            valor={b.objetivoOtro ? `${b.objetivoPrincipal}: ${b.objetivoOtro}` : b.objetivoPrincipal} />
          <Dato label="Inscripción de campaña" valor={fecha(b.fechaInicio)} />
          <Dato label="Fecha final" valor={fecha(b.fechaFinal)} />
          <Dato label="Inicio de publicaciones" valor={fecha(b.fechaPublicacion)} />
          <Dato label="Fechas clave inamovibles" valor={b.fechasClave} />
          <Dato label="Presupuesto total" valor={cop(b.presupuestoTotal)} />
          <Dato label="Pauta / amplificación pagada" valor={pauta} />
          <Dato label="KPI de éxito" valor={b.kpis} />
          <Dato label="Campañas previas" valor={b.campanasPrevias} />
        </Bloque>

        <Bloque numero="03" titulo="Producto o servicio">
          <Lista label="Qué se promociona" valores={b.queSePromociona} />
          <Dato label="Precio y dónde se compra" valor={b.precioYCompra} />
          <Dato label="Territorio de promoción" valor={b.territorioPromocion} />
          <Dato label="Público objetivo" valor={b.publicoObjetivo} />
          <Dato label="Muestra o acceso al creador" valor={b.enviaMuestra} />
          <Dato label="Problema que resuelve" valor={b.problemaResuelve} />
          <Lista label="Atributos" valores={b.atributos} />
          <Dato label="Competidores directos" valor={b.competidores} />
        </Bloque>

        <Bloque numero="04" titulo="Mensajes y comunicación">
          <Dato label="Claims obligatorios" valor={b.claimsObligatorios} />
          <Dato label="Claims prohibidos" valor={b.claimsProhibidos} />
          <Dato label="Libertad creativa" valor={libertad} />
          <Dato label="Datos importantes" valor={b.datosDuros} />
          <Dato label="Temas sensibles" valor={b.temasSensibles} />
          <Lista label="Tono" valores={b.tono} />
        </Bloque>

        <Bloque numero="05" titulo="Enlaces y menciones">
          <Dato label="URL / Landing page" valor={b.landingUrl} />
          <Dato label="Usuarios a etiquetar" valor={b.usuariosEtiquetar} />
          <Dato label="Hashtags" valor={b.hashtags} />
          <Dato label="App y tienda" valor={b.appYTienda} />
          <Dato label="Código de descuento" valor={b.codigoDescuento} />
        </Bloque>

        <Bloque numero="06" titulo="Creadores de contenido">
          <Lista label="Nichos / categorías" valores={b.nichos} />
          {creadores.length > 0 && (
            <div className="py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Creadores sugeridos
              </dt>
              <dd className="mt-2 space-y-1.5">
                {creadores.map((c, i) => (
                  <div key={i} className="text-sm">
                    <span className="text-gray-900">{c.nombre}</span>
                    {c.linkPerfil && (
                      <>
                        {" · "}
                        <a href={c.linkPerfil} target="_blank" rel="noopener noreferrer"
                          className="text-blue-600 hover:underline">
                          {c.linkPerfil}
                        </a>
                      </>
                    )}
                  </div>
                ))}
              </dd>
            </div>
          )}
          <Lista label="Plataformas prioritarias" valores={b.plataformas} />
          <Dato label="Tamaño de audiencia" valor={b.tamanoAudiencia} />
          <Dato label="Cantidad estimada" valor={b.cantidadCreadores} />
          <Dato label="Ciudad o país del creador" valor={b.ciudadPaisCreador} />
          <Dato label="Perfil demográfico" valor={b.perfilDemografico} />
          <Dato label="Presencia física" valor={b.presenciaFisica} />
          <Dato label="Creadores vetados" valor={b.creadoresVetados} />
          <Dato label="Marcas vetadas" valor={b.marcasVetadas} />
        </Bloque>

        <Bloque numero="07" titulo="Condiciones legales y de uso">
          <Dato label="Contenido en colaboración con la marca"
            valor={b.colaboracionConMarca === "SI" ? "Sí" : "No"} />
          <Lista label="Etiqueta de publicidad" valores={b.etiquetaPublicidad} />
          <Dato label="Exclusividad de categoría" valor={b.exclusividad} />
          <Dato label="Permanencia del contenido" valor={b.permanenciaContenido} />
          <Dato label="Restricciones legales" valor={b.restriccionesLegales} />
        </Bloque>

        <Bloque numero="08" titulo="Documentos adjuntos">
          {documentos.length === 0 ? (
            <p className="py-3 text-sm text-gray-500">No se adjuntaron documentos.</p>
          ) : (
            <div className="space-y-2 py-3">
              {documentos.map((doc, i) => (
                <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">
                  <span className="flex items-center gap-2 truncate text-gray-700">
                    <Paperclip className="h-4 w-4 shrink-0 text-gray-400" />
                    {doc.nombre}
                    <span className="text-gray-400">
                      ({(doc.tamano / 1024).toFixed(0)} KB)
                    </span>
                  </span>
                  <Download className="h-4 w-4 shrink-0 text-gray-400" />
                </a>
              ))}
            </div>
          )}
        </Bloque>

        <Bloque numero="09" titulo="Referencias">
          <Dato label="Referencias que les gustan" valor={b.referenciasGustan} />
          <Dato label="Referencias que no quieren" valor={b.referenciasNoGustan} />
          <Dato label="Comentarios adicionales" valor={b.comentarios} />
        </Bloque>
      </div>
    </>
  );
}
