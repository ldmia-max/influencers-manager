import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { syncSocialAccountMetrics } from "@/lib/apify";
import {
  getProfileWithSocialAccounts,
  updateSocialAccountMetrics,
} from "@/data-access/profiles";
import { NotFoundError } from "@/data-access/errors";
import { exigirPermiso } from "@/lib/api-guard";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Sincronizar metricas es actualizar el perfil, y los perfiles son
    // catalogo compartido: no se exige ser quien lo creo.
    const sesion = await exigirPermiso("perfiles", "actualizar");
    if (sesion instanceof NextResponse) return sesion;

    const { id } = await params;
    const profile = await getProfileWithSocialAccounts(id);

    const results = [];
    const errors = [];

    // Sincronizar cada cuenta social
    for (const account of profile.socialAccounts) {
      try {
        const platformName = account.platform.name.toLowerCase();

        if (platformName === "instagram" ||
          platformName === "tiktok" ||
          platformName === "youtube" ||
          platformName === "kick") {
          const metrics = await syncSocialAccountMetrics(
            platformName as "instagram" | "tiktok" | "youtube" | "kick",
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
