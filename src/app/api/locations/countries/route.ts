import { NextResponse } from "next/server";
import { getCachedCountries } from "@/lib/cache";

export async function GET() {
  try {
    const countries = await getCachedCountries();
    return NextResponse.json(countries);
  } catch (error) {
    console.error("Error fetching countries:", error);
    return NextResponse.json(
      { error: "Error al obtener países" },
      { status: 500 }
    );
  }
}
