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

  // Solo se edita una campana Abierta. En Revision la esta mirando el
  // cliente y cambiarla por debajo le mostraria una propuesta distinta a
  // la que aprueba; en En proceso hay precios ya aprobados y contenido ya
  // publicado. Alli los influencers se anaden o retiran desde la ficha,
  // que es una operacion acotada y no una reedicion.
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

  // Solo quedan fuera del editor los RETIRADOS: esos ya salieron de la
  // campana y no deben poder volver a proponerse.
  //
  // Los que el cliente rechazo pero siguen dentro SI se cargan, con sus
  // formatos y sus precios. Sacarlos abria la campana como si nunca
  // hubieran estado —presupuesto en cero incluido— y obligaba a rehacer
  // la seleccion entera. Se ven, se sabe que fueron rechazados, y quien
  // edita decide si los quita; al quitarlos pasan a RETIRADO y entonces
  // si dejan de ofrecerse.
  const retirados = campaign.profiles.filter(
    (cp) => cp.participacion === "RETIRADO"
  );
  const idsRetirados = new Set(retirados.map((cp) => cp.profile.id));

  const perfilesRechazados = retirados.map((cp) => ({
    id: cp.profile.id,
    nombre: cp.profile.name,
    motivo: cp.motivoRetiro ?? cp.rejectionReason,
  }));

  // El catalogo de seleccionables no los ofrece. El resto sigue entero,
  // porque el editor lo usa tambien para resolver los datos de cada
  // perfil ya seleccionado.
  const perfilesDisponibles = profiles.filter((p) => !idsRetirados.has(p.id));

  const enJuego = campaign.profiles.filter(
    (cp) => !idsRetirados.has(cp.profile.id)
  );

  // Extraer IDs de perfiles seleccionados y su configuración
  const existingProfileIds = enJuego.map((cp) => cp.profile.id);
  const existingConfig = enJuego.map((cp) => ({
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
        profiles={perfilesDisponibles}
        existingProfileIds={existingProfileIds}
        existingConfig={existingConfig}
        perfilesRechazados={perfilesRechazados}
        currentStatus={campaign.status}
        markup={campaign.markupPercentage}
      />
    </div>
  );
}
