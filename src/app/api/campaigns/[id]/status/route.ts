import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { transitionCampaignStatus, getCampaignById } from "@/data-access/campaigns";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { notifyCampaignSentToReview } from "@/lib/emails/campaign-notifications";
import { parseBody } from "@/lib/validate-request";
import { transitionStatusSchema } from "@/lib/schemas/campaign";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id: campaignId } = await params;
    const isAdmin = session.user.role === "ADMIN";

    // Check ownership
    const existing = await getCampaignById(campaignId);
    if (!isAdmin && existing.createdById !== session.user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await parseBody(req, transitionStatusSchema);
    if (body instanceof NextResponse) return body;

    const result = await transitionCampaignStatus(campaignId, body.status, body.reason);

    // Send email notification if transitioning to REVIEW
    if (result.emailData && result.approvalToken) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      notifyCampaignSentToReview({
        contactEmail: result.emailData.contactEmail,
        contactName: result.emailData.contactName,
        campaignName: result.emailData.campaignName,
        companyName: result.emailData.companyName,
        approvalToken: result.approvalToken,
        expiresAt,
      });
    }

    // Build response
    const response: {
      campaign: typeof result.campaign;
      message: string;
      approvalToken?: string;
      approvalUrl?: string;
    } = {
      campaign: result.campaign,
      message: result.message,
    };

    if (result.approvalToken) {
      response.approvalToken = result.approvalToken;
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      response.approvalUrl = `${baseUrl}/approve/${result.approvalToken}`;
    }

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ValidationError) {
      // Check if it's a JSON-encoded error with details (ACTIVE transition)
      try {
        const parsed = JSON.parse(error.message);
        return NextResponse.json(parsed, { status: 400 });
      } catch {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Error updating campaign status:", error);
    return NextResponse.json(
      { error: "Error al actualizar el estado de la campaña" },
      { status: 500 }
    );
  }
}
