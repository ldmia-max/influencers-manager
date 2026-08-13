import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import { getCachedCities } from "@/lib/cache";

export async function GET(request: NextRequest) {
  await connection();

  try {
    const departmentId = request.nextUrl.searchParams.get("departmentId") || undefined;
    const countryId = request.nextUrl.searchParams.get("countryId") || undefined;

    const cities = await getCachedCities(departmentId, countryId);
    return NextResponse.json(cities);
  } catch (error) {
    console.error("Error fetching cities:", error);
    return NextResponse.json(
      { error: "Error al obtener ciudades" },
      { status: 500 }
    );
  }
}
