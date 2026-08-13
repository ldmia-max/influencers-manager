import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import { getCachedDepartments } from "@/lib/cache";

export async function GET(request: NextRequest) {
  await connection();

  try {
    const countryId = request.nextUrl.searchParams.get("countryId") || undefined;

    const departments = await getCachedDepartments(countryId);
    return NextResponse.json(departments);
  } catch (error) {
    console.error("Error fetching departments:", error);
    return NextResponse.json(
      { error: "Error al obtener departamentos" },
      { status: 500 }
    );
  }
}
