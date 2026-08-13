import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { syncSocialAccountMetrics } from "@/lib/apify";
import {
  getProfilesPaginated,
  getProfilesAll,
  createProfile,
  updateSocialAccountMetrics,
  refetchProfile,
} from "@/data-access/profiles";
import { ValidationError } from "@/data-access/errors";
import { parseBody } from "@/lib/validate-request";
import { profileSchema } from "@/lib/schemas/profile";

export async function GET(req: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");

    const usePagination = pageParam !== null || pageSizeParam !== null;
    const page = parseInt(pageParam || "1");
    const pageSize = parseInt(pageSizeParam || "50");

    const where =
      session.user.role === "ADMIN"
        ? undefined
        : { createdById: session.user.id };

    if (usePagination) {
      const result = await getProfilesPaginated(where, page, pageSize);
      return NextResponse.json(result);
    }

    const profiles = await getProfilesAll(where);
    return NextResponse.json(profiles);
  } catch (error) {
    console.error("Error fetching profiles:", error);
    return NextResponse.json(
      { error: "Error al obtener perfiles" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await parseBody(req, profileSchema);
    if (body instanceof NextResponse) return body;

    const profile = await createProfile({
      ...body,
      createdById: session.user.id,
    });

    // Sincronizar datos de Apify para cada cuenta social
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
          }
        }
      } catch (error) {
        console.error(
          `Error syncing Apify data for ${account.platform.name}:`,
          error
        );
      }
    }

    // Obtener el perfil actualizado con los datos de Apify
    const updatedProfile = await refetchProfile(profile.id);
    revalidateTag("profiles", "hours");

    return NextResponse.json(updatedProfile, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error creating profile:", error);
    return NextResponse.json(
      { error: "Error al crear perfil" },
      { status: 500 }
    );
  }
}
