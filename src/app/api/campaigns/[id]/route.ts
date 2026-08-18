import { NextResponse } from "next/server";
import {
  getCampaignById,
  updateCampaign,
  deleteCampaign,
} from "@/data-access/campaigns";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { exigirPermiso, exigirPropiedad } from "@/lib/api-guard";
import { parseBody } from "@/lib/validate-request";
import { updateCampaignSchema } from "@/lib/schemas/campaign";
import { calculateMarkupPrice } from "@/lib/campaign-utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("campanas", "leer");
    if (sesion instanceof NextResponse) return sesion;

    const { id } = await params;
    const campaign = await getCampaignById(id);

    const sinPermiso = exigirPropiedad(sesion, "campanas", campaign.createdById);
    if (sinPermiso) return sinPermiso;

    // Calcular totales
    let totalBase = 0;
    campaign.profiles.forEach((cp) => {
      cp.platforms.forEach((cpp) => {
        cpp.services.forEach((cs) => {
          totalBase += Number(cs.basePrice) * cs.quantity;
        });
      });
    });

    const totalWithMarkup = calculateMarkupPrice(
      totalBase,
      campaign.markupPercentage
    );

    return NextResponse.json({
      ...campaign,
      totalBase,
      totalWithMarkup,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Error fetching campaign:", error);
    return NextResponse.json(
      { error: "Error al obtener campaña" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("campanas", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { id } = await params;
    const existing = await getCampaignById(id);

    const sinPermiso = exigirPropiedad(sesion, "campanas", existing.createdById);
    if (sinPermiso) return sinPermiso;

    const body = await parseBody(req, updateCampaignSchema);
    if (body instanceof NextResponse) return body;

    const campaign = await updateCampaign(id, body);

    return NextResponse.json(campaign);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Error updating campaign:", error);
    return NextResponse.json(
      { error: "Error al actualizar campaña" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("campanas", "borrar");
    if (sesion instanceof NextResponse) return sesion;

    const { id } = await params;
    const existing = await getCampaignById(id);

    const sinPermiso = exigirPropiedad(sesion, "campanas", existing.createdById);
    if (sinPermiso) return sinPermiso;

    await deleteCampaign(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Error deleting campaign:", error);
    return NextResponse.json(
      { error: "Error al eliminar campaña" },
      { status: 500 }
    );
  }
}
