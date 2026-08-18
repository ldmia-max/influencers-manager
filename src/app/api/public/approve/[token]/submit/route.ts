import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  COOKIE_APROBACION,
  verificarSesionAprobacion,
} from "@/lib/approval-session";
import { submitApproval } from "@/data-access/campaign-approval";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { notifyApprovalResult } from "@/lib/emails/campaign-notifications";
import { parseBody } from "@/lib/validate-request";
import { submitApprovalBodySchema } from "@/lib/schemas/approval";
import { auditar, ACCIONES } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ token: string }>;
}

// POST: Finalizar proceso de aprobación
/**
 * Exige sesion de aprobacion verificada para este token.
 *
 * Sin esto el enlace bastaba para ver y decidir sobre la campana, y
 * reenviar el correo entregaba ese poder a cualquiera.
 */
async function exigirVerificacion(token: string) {
  const almacen = await cookies();
  const sesion = await verificarSesionAprobacion(
    almacen.get(COOKIE_APROBACION)?.value,
    token
  );

  if (!sesion) {
    return NextResponse.json(
      { error: "Verifica tu correo para continuar", code: "SIN_VERIFICAR" },
      { status: 401 }
    );
  }
  return sesion;
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { token } = await params;

    const sesion = await exigirVerificacion(token);
    if (sesion instanceof NextResponse) return sesion;

    const body = await parseBody(req, submitApprovalBodySchema);
    if (body instanceof NextResponse) return body;
    const { summary, emailData } = await submitApproval(token, body.finalDecisions);

    // La pieza que faltaba: si el cliente discute lo aprobado, aqui
    // consta quien lo hizo, cuando y desde donde. El correo sale de la
    // sesion verificada por codigo, no de lo que mande el navegador.
    await auditar({
      action: ACCIONES.aprobacionEnviada,
      entity: "Campaign",
      entityId: emailData.campaignId,
      actorType: "APPROVAL",
      actorEmail: sesion.email,
      summary: `${sesion.email} finalizó la revisión de "${emailData.campaignName}": ${summary.approvedProfiles} aprobados y ${summary.rejectedProfiles} rechazados`,
      metadata: {
        totalPerfiles: summary.totalProfiles,
        aprobados: summary.approvedProfiles,
        rechazados: summary.rejectedProfiles,
        cliente: emailData.clientName,
      },
      req,
    });

    // Notify campaign creator via email
    notifyApprovalResult({
      campaignId: emailData.campaignId,
      campaignName: emailData.campaignName,
      clientName: emailData.clientName,
      contactName: emailData.contactName,
      createdById: emailData.createdById,
      summary: {
        totalProfiles: summary.totalProfiles,
        approvedProfiles: summary.approvedProfiles,
        rejectedProfiles: summary.rejectedProfiles,
      },
      rejectedProfileIds: emailData.rejectedProfileIds,
    }).catch((err) => console.error("Failed to send approval result email:", err));

    return NextResponse.json({
      message: "Aprobación finalizada correctamente",
      summary,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: "Token no válido", code: "INVALID_TOKEN" },
        { status: 404 }
      );
    }
    if (error instanceof ValidationError) {
      const codeMap: Record<string, { message: string; status: number }> = {
        EXPIRED_TOKEN: { message: "El enlace de aprobación ha expirado", status: 410 },
        USED_TOKEN: { message: "Este enlace ya fue utilizado", status: 410 },
        INVALID_STATUS: { message: "La campaña ya no está disponible para revisión", status: 400 },
      };
      const mapped = codeMap[error.message];
      if (mapped) {
        return NextResponse.json(
          { error: mapped.message, code: error.message },
          { status: mapped.status }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error submitting approval:", error);
    return NextResponse.json(
      { error: "Error al finalizar la aprobación" },
      { status: 500 }
    );
  }
}
