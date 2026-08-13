import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAllServiceTypesWithCounts, createServiceType } from "@/data-access/service-types";
import { ValidationError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { createServiceTypeSchema } from "@/lib/schemas/service-type";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const serviceTypes = await getAllServiceTypesWithCounts();
    return NextResponse.json(serviceTypes);
  } catch (error) {
    console.error("Error fetching service types:", error);
    return NextResponse.json(
      { error: "Error al obtener formatos" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await parseBody(req, createServiceTypeSchema);
    if (body instanceof NextResponse) return body;
    const serviceType = await createServiceType({ name: body.name, displayName: body.displayName, platformId: body.platformId, profileTypes: body.profileTypes });
    return NextResponse.json(serviceType, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error creating service type:", error);
    return NextResponse.json(
      { error: "Error al crear formato" },
      { status: 500 }
    );
  }
}
