import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { syncSocialAccountMetrics } from "@/lib/apify";
import {
  getProfileById,
  updateProfile,
  deleteProfile,
  updateSocialAccountMetrics,
  refetchProfile,
} from "@/data-access/profiles";
import { ValidationError, NotFoundError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { profileSchema } from "@/lib/schemas/profile";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const profile = await getProfileById(id);
    return NextResponse.json(profile);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { error: "Error al obtener perfil" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await parseBody(req, profileSchema);
    if (body instanceof NextResponse) return body;

    const profile = await updateProfile(id, body);

    // Sincronizar Apify para cuentas sociales
    let apifyUpdated = false;
    if (profile?.socialAccounts) {
      for (const account of profile.socialAccounts) {
        try {
          const platformName = account.platform.name.toLowerCase();

          if (platformName === "instagram" || platformName === "tiktok") {
            const metrics = await syncSocialAccountMetrics(
              platformName as "instagram" | "tiktok",
              account.username
            );

            if (metrics) {
              await updateSocialAccountMetrics(account.id, metrics);
              apifyUpdated = true;
            }
          }
        } catch (error) {
          console.error(
            `Error syncing Apify data for ${account.platform.name}:`,
            error
          );
        }
      }
    }

    // Solo hacer query adicional si Apify actualizó datos
    const finalProfile = apifyUpdated
      ? await refetchProfile(id)
      : profile;

    revalidateTag("profiles", "hours");
    return NextResponse.json(finalProfile);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Error al actualizar perfil" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Solo administradores pueden eliminar perfiles
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Solo administradores pueden eliminar perfiles" },
        { status: 403 }
      );
    }

    await deleteProfile(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Error deleting profile:", error);
    return NextResponse.json(
      { error: "Error al eliminar perfil" },
      { status: 500 }
    );
  }
}
