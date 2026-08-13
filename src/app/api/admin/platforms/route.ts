import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAllPlatformsWithCounts, createPlatform } from "@/data-access/platforms";
import { ValidationError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { createPlatformSchema } from "@/lib/schemas/platform";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const platforms = await getAllPlatformsWithCounts();
    return NextResponse.json(platforms);
  } catch (error) {
    console.error("Error fetching platforms:", error);
    return NextResponse.json(
      { error: "Error al obtener plataformas" },
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

    const body = await parseBody(req, createPlatformSchema);
    if (body instanceof NextResponse) return body;
    const platform = await createPlatform(body.name, body.displayName);
    return NextResponse.json(platform, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error creating platform:", error);
    return NextResponse.json(
      { error: "Error al crear plataforma" },
      { status: 500 }
    );
  }
}
