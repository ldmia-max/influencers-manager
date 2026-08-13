import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCampaignsPaginated, createCampaign } from "@/data-access/campaigns";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { CampaignStatus } from "@prisma/client";
import { parseBody } from "@/lib/validate-request";
import { createCampaignSchema } from "@/lib/schemas/campaign";

export async function GET(req: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;
    const clientId = searchParams.get("clientId") || undefined;
    const status = searchParams.get("status") as CampaignStatus | undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");

    const result = await getCampaignsPaginated({
      userId: session.user.id,
      isAdmin: session.user.role === "ADMIN",
      search,
      clientId,
      status,
      page,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    return NextResponse.json(
      { error: "Error al obtener campañas" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await parseBody(req, createCampaignSchema);
    if (body instanceof NextResponse) return body;

    const campaign = await createCampaign({
      ...body,
      createdById: session.user.id,
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Error creating campaign:", error);
    return NextResponse.json(
      { error: "Error al crear campaña" },
      { status: 500 }
    );
  }
}
