import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { CampaignEditor } from "@/components/campaigns/campaign-editor";
import { getCampaignForEdit } from "@/data-access/campaigns";
import { getClientsWithContacts } from "@/data-access/clients";
import { getAllProfilesForEditor } from "@/data-access/profiles";
import { exigePropiedadParaEscribir, type Rol } from "@/lib/permissions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCampaignPage({ params }: PageProps) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user) {
    redirect("/login");
  }

  let campaign;
  try {
    campaign = await getCampaignForEdit(id);
  } catch {
    notFound();
  }

  // El alcance lo decide la tabla de permisos, no el rol: hoy las
  // campanas son de todo el equipo, pero si manana se restringen basta
  // con cambiar la tabla y esta comprobacion sigue valiendo.
  if (
    exigePropiedadParaEscribir(session.user.role as Rol, "campanas") &&
    campaign.createdById !== session.user.id
  ) {
    redirect("/campaigns");
  }

  // Solo editar si está en DRAFT o PENDING
  if (campaign.status !== "DRAFT" && campaign.status !== "PENDING") {
    redirect(`/campaigns/${id}`);
  }

  const [clients, profiles] = await Promise.all([
    getClientsWithContacts(),
    getAllProfilesForEditor(),
  ]);

  // Formatear datos de la campaña para el editor
  const campaignData = {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description || "",
    clientId: campaign.clientId,
    clientContactId: campaign.clientContactId,
    budget: Number(campaign.budget).toString(),
    startDate: campaign.startDate
      ? campaign.startDate.toISOString().split("T")[0]
      : "",
    endDate: campaign.endDate
      ? campaign.endDate.toISOString().split("T")[0]
      : "",
  };

  // Extraer IDs de perfiles seleccionados y su configuración
  const existingProfileIds = campaign.profiles.map((cp) => cp.profile.id);
  const existingConfig = campaign.profiles.map((cp) => ({
    profileId: cp.profile.id,
    profileName: cp.profile.name,
    platforms: cp.platforms.map((cpp) => ({
      socialAccountId: cpp.socialAccount.id,
      platformId: "",
      platformName: "",
      username: "",
      selected: true,
      services: cpp.services.map((cs) => ({
        profileServiceId: cs.profileServiceId,
        serviceTypeId: "",
        serviceName: "",
        quantity: cs.quantity,
        basePrice: Number(cs.basePrice),
      })),
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Editar Campaña</h1>
        <p className="text-gray-500 mt-1">
          {campaign.name} - {campaign.client.companyName}
        </p>
      </div>

      <CampaignEditor
        campaignId={id}
        initialData={campaignData}
        clients={clients}
        profiles={profiles}
        existingProfileIds={existingProfileIds}
        existingConfig={existingConfig}
        currentStatus={campaign.status}
      />
    </div>
  );
}
