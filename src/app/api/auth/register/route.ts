import { NextResponse } from "next/server";
import { registerUser } from "@/data-access/users";
import { ValidationError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { registerSchema } from "@/lib/schemas/auth";

export async function POST(req: Request) {
  try {
    const body = await parseBody(req, registerSchema);
    if (body instanceof NextResponse) return body;
    const user = await registerUser(body);
    return NextResponse.json({ success: true, user });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error registering user:", error);
    return NextResponse.json(
      { error: "Error al registrar usuario" },
      { status: 500 }
    );
  }
}
