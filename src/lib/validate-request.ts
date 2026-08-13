import { NextResponse } from "next/server";
import type { z } from "zod";

/**
 * Parse and validate a JSON request body against a Zod schema.
 * Returns the validated data or a 400 NextResponse with error details.
 */
export async function parseBody<T extends z.ZodType>(
  req: Request,
  schema: T
): Promise<z.infer<T> | NextResponse> {
  try {
    const json = await req.json();
    const result = schema.safeParse(json);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      return NextResponse.json(
        { error: "Datos inválidos", details },
        { status: 400 }
      );
    }

    return result.data;
  } catch {
    return NextResponse.json(
      { error: "JSON inválido en el cuerpo de la petición" },
      { status: 400 }
    );
  }
}
