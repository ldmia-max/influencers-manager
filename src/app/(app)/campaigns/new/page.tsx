import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CampaignEditor } from "@/components/campaigns/campaign-editor";
import { getClientsWithContacts } from "@/data-access/clients";
import { getAllProfilesForEditor } from "@/data-access/profiles";
import { periodoDeImputacion } from "@/lib/campaign-utils";

export default async function NewCampaignPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const [clients, profiles] = await Promise.all([
    getClientsWithContacts(),
    getAllProfilesForEditor(),
  ]);

  // Datos iniciales vacíos para nueva campaña
  const initialData = {
    name: "",
    description: "",
    clientId: "",
    clientContactId: "",
    clientContactIds: [],
    budget: "",
    startDate: "",
    endDate: "",
    // Periodo de imputacion: arranca en el mes en curso. Es obligatorio
    // —contabilidad agrupa por el—, asi que nace con valor en vez de
    // vacio para no convertirlo en un paso mas.
    mes: String(periodoDeImputacion().mes),
    anio: String(periodoDeImputacion().anio),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nueva Campaña</h1>
        <p className="text-gray-500 mt-1">
          Configura los detalles, selecciona perfiles y formatos
        </p>
      </div>

      <CampaignEditor
        initialData={initialData}
        clients={clients}
        profiles={profiles}
      />
    </div>
  );
}
