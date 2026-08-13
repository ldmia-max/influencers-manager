import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getCampaignById,
  updateCampaign,
  deleteCampaign,
} from "@/data-access/campaigns";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { updateCampaignSchema } from "@/lib/schemas/campaign";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const isAdmin = session.user.role === "ADMIN";

    const campaign = await getCampaignById(id);

    // Verificar acceso
    if (!isAdmin && campaign.createdById !== session.user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Calcular totales
    let totalBase = 0;
    campaign.profiles.forEach((cp) => {
      cp.platforms.forEach((cpp) => {
        cpp.services.forEach((cs) => {
          totalBase += Number(cs.basePrice) * cs.quantity;
        });
      });
    });

    const totalWithMarkup = totalBase * 1.2;

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
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const isAdmin = session.user.role === "ADMIN";

    // Check ownership before attempting update
    const existing = await getCampaignById(id);
    if (!isAdmin && existing.createdById !== session.user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

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
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const isAdmin = session.user.role === "ADMIN";

    // Check ownership before delete
    const existing = await getCampaignById(id);
    if (!isAdmin && existing.createdById !== session.user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

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
