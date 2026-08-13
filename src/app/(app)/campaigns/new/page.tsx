import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CampaignEditor } from "@/components/campaigns/campaign-editor";
import { getClientsWithContacts } from "@/data-access/clients";
import { getAllProfilesForEditor } from "@/data-access/profiles";

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
    budget: "",
    startDate: "",
    endDate: "",
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
