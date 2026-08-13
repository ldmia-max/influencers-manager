import { NextResponse } from "next/server";
import { briefSchema } from "@/lib/schemas/brief";
import { createCampaignBrief } from "@/data-access/campaign-briefs";
import {
  guardarDocumentosBrief,
  validarDocumentosSubidos,
  UploadError,
} from "@/services/brief-uploads";
import { notifyNewBrief } from "@/lib/emails/brief-notifications";

/**
 * POST /api/public/brief
 *
 * Endpoint PUBLICO: no requiere sesion. El middleware solo intercepta
 * /dashboard, /admin, /api/admin, /login y /register, asi que esta ruta
 * queda abierta sin configuracion adicional.
 *
 * Recibe multipart/form-data:
 *   - campo "data": JSON con las respuestas del brief
 *   - campo "documentos": cero o mas archivos adjuntos
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const crudo = formData.get("data");
    if (typeof crudo !== "string") {
      return NextResponse.json(
        { error: "Falta el contenido del brief" },
        { status: 400 }
      );
    }

    let json: unknown;
    try {
      json = JSON.parse(crudo);
    } catch {
      return NextResponse.json(
        { error: "El contenido del brief no es JSON valido" },
        { status: 400 }
      );
    }

    const resultado = briefSchema.safeParse(json);
    if (!resultado.success) {
      return NextResponse.json(
        {
          error: "Hay campos obligatorios sin completar",
          details: resultado.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    // Dos caminos segun el entorno:
    //  - Vercel: el navegador ya subio los archivos a Blob y aqui solo
    //    llega su metadata, para no chocar con el limite de 4.5 MB.
    //  - Local y OVH: los archivos vienen dentro de este mismo POST.
    const subidos = formData.get("documentosSubidos");
    let documentos;

    if (typeof subidos === "string" && subidos) {
      documentos = validarDocumentosSubidos(JSON.parse(subidos));
    } else {
      const archivos = formData
        .getAll("documentos")
        .filter((f): f is File => f instanceof File);
      documentos = await guardarDocumentosBrief(archivos);
    }

    const brief = await createCampaignBrief(resultado.data, documentos);

    // Aviso al equipo de cuenta. No se espera: si el correo falla, el
    // brief ya quedo guardado y el cliente no debe ver un error.
    const d = resultado.data;
    notifyNewBrief({
      briefId: brief.id,
      empresa: d.empresa,
      responsable: d.responsable,
      cargo: d.cargo,
      correo: d.correo,
      telefono: d.telefono,
      nombreCampana: d.nombreCampana,
      objetivoPrincipal: d.objetivoPrincipal,
      presupuestoTotal: Number(d.presupuestoTotal),
      fechaInicio: new Date(d.fechaInicio),
      fechaFinal: new Date(d.fechaFinal),
      fechaPublicacion: new Date(d.fechaPublicacion),
      nichos: d.nichos,
      totalDocumentos: documentos.length,
    }).catch((err) => console.error("Fallo el aviso de brief nuevo:", err));

    return NextResponse.json(
      {
        message: "Brief recibido correctamente",
        briefId: brief.id,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error al guardar el brief:", error);
    return NextResponse.json(
      { error: "No se pudo guardar el brief. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
