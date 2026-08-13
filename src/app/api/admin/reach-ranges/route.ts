import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAllReachRanges, createReachRange } from "@/data-access/reach-ranges";
import { ValidationError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { createReachRangeSchema } from "@/lib/schemas/reach-range";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const reachRanges = await getAllReachRanges();
    return NextResponse.json(reachRanges);
  } catch (error) {
    console.error("Error fetching reach ranges:", error);
    return NextResponse.json(
      { error: "Error al obtener rangos de alcance" },
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

    const body = await parseBody(req, createReachRangeSchema);
    if (body instanceof NextResponse) return body;
    const reachRange = await createReachRange({ name: body.name, displayName: body.displayName, minFollowers: body.minFollowers, maxFollowers: body.maxFollowers, reachPercentage: body.reachPercentage });
    return NextResponse.json(reachRange, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error creating reach range:", error);
    return NextResponse.json(
      { error: "Error al crear rango de alcance" },
      { status: 500 }
    );
  }
}
