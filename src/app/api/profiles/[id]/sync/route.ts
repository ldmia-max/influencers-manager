import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { syncSocialAccountMetrics } from "@/lib/apify";
import {
  getProfileWithSocialAccounts,
  updateSocialAccountMetrics,
} from "@/data-access/profiles";
import { NotFoundError } from "@/data-access/errors";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const profile = await getProfileWithSocialAccounts(id);

    // Verificar acceso
    if (
      session.user.role !== "ADMIN" &&
      profile.createdById !== session.user.id
    ) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const results = [];
    const errors = [];

    // Sincronizar cada cuenta social
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

            results.push({
              platform: account.platform.displayName,
              username: account.username,
              success: true,
            });
          } else {
            errors.push({
              platform: account.platform.displayName,
              username: account.username,
              error: "No se pudieron obtener datos",
            });
          }
        } else {
          results.push({
            platform: account.platform.displayName,
            username: account.username,
            skipped: true,
            reason: "Plataforma no soportada",
          });
        }
      } catch (error) {
        console.error(
          `Error syncing ${account.platform.name}/@${account.username}:`,
          error
        );
        errors.push({
          platform: account.platform.displayName,
          username: account.username,
          error: error instanceof Error ? error.message : "Error desconocido",
        });
      }
    }

    revalidateTag("profiles", "hours");

    return NextResponse.json({
      success: true,
      results,
      errors: errors.length > 0 ? errors : undefined,
      message:
        errors.length > 0
          ? `Sincronizado con algunos errores`
          : `Sincronizado exitosamente`,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Error syncing profile:", error);
    return NextResponse.json(
      { error: "Error al sincronizar perfil" },
      { status: 500 }
    );
  }
}
