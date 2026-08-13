import { NextResponse } from "next/server";
import { getCachedReachRanges } from "@/lib/cache";

export async function GET() {
  try {
    const reachRanges = await getCachedReachRanges();
    return NextResponse.json(reachRanges);
  } catch (error) {
    console.error("Error fetching reach ranges:", error);
    return NextResponse.json(
      { error: "Error al obtener rangos de alcance" },
      { status: 500 }
    );
  }
}
