import { NextResponse } from "next/server";
import { getCampaignById } from "@/data-access/campaigns";
import {
  getCampaignProfiles,
  setCampaignProfiles,
  removeCampaignProfiles,
} from "@/data-access/campaign-profiles";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { exigirPermiso, exigirPropiedad } from "@/lib/api-guard";
import { parseBody } from "@/lib/validate-request";
import { setCampaignProfilesSchema, removeCampaignProfilesSchema } from "@/lib/schemas/campaign";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("campanas", "leer");
    if (sesion instanceof NextResponse) return sesion;

    const { id: campaignId } = await params;
    const campaign = await getCampaignById(campaignId);

    const sinPermiso = exigirPropiedad(sesion, "campanas", campaign.createdById);
    if (sinPermiso) return sinPermiso;

    const profiles = await getCampaignProfiles(campaignId);

    return NextResponse.json({ profiles });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Error fetching campaign profiles:", error);
    return NextResponse.json(
      { error: "Error al obtener perfiles de la campaña" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("campanas", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { id: campaignId } = await params;
    const campaign = await getCampaignById(campaignId);

    const sinPermiso = exigirPropiedad(sesion, "campanas", campaign.createdById);
    if (sinPermiso) return sinPermiso;

    if (campaign.status !== "DRAFT" && campaign.status !== "PENDING") {
      return NextResponse.json(
        { error: "Solo se pueden modificar campañas en estado borrador o pendiente" },
        { status: 400 }
      );
    }

    const body = await parseBody(req, setCampaignProfilesSchema);
    if (body instanceof NextResponse) return body;
    const result = await setCampaignProfiles(campaignId, body.profiles);

    return NextResponse.json({ profiles: result }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Error adding profiles to campaign:", error);
    return NextResponse.json(
      { error: "Error al agregar perfiles a la campaña" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const sesion = await exigirPermiso("campanas", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { id: campaignId } = await params;
    const campaign = await getCampaignById(campaignId);

    const sinPermiso = exigirPropiedad(sesion, "campanas", campaign.createdById);
    if (sinPermiso) return sinPermiso;

    if (campaign.status !== "DRAFT" && campaign.status !== "PENDING") {
      return NextResponse.json(
        { error: "Solo se pueden modificar campañas en estado borrador o pendiente" },
        { status: 400 }
      );
    }

    const body = await parseBody(req, removeCampaignProfilesSchema);
    if (body instanceof NextResponse) return body;
    await removeCampaignProfiles(campaignId, body.profileIds);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Error removing profiles from campaign:", error);
    return NextResponse.json(
      { error: "Error al eliminar perfiles de la campaña" },
      { status: 500 }
    );
  }
}
