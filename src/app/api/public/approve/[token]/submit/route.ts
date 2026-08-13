import { NextResponse } from "next/server";
import { submitApproval } from "@/data-access/campaign-approval";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { notifyApprovalResult } from "@/lib/emails/campaign-notifications";
import { parseBody } from "@/lib/validate-request";
import { submitApprovalBodySchema } from "@/lib/schemas/approval";

interface RouteParams {
  params: Promise<{ token: string }>;
}

// POST: Finalizar proceso de aprobación
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { token } = await params;

    const body = await parseBody(req, submitApprovalBodySchema);
    if (body instanceof NextResponse) return body;
    const { summary, emailData } = await submitApproval(token, body.finalDecisions);

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
