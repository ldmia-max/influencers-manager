import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CampaignFromCartEditor } from "@/components/campaigns/campaign-from-cart-editor";
import { getClientsWithContacts } from "@/data-access/clients";
import { getAllProfilesForEditor } from "@/data-access/profiles";

export default async function NewCampaignFromCartPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const [clients, profiles] = await Promise.all([
    getClientsWithContacts(),
    getAllProfilesForEditor(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nueva Campana desde Carrito</h1>
        <p className="text-gray-500 mt-1">
          Los perfiles y formatos del carrito han sido pre-cargados
        </p>
      </div>

      <CampaignFromCartEditor
        clients={clients}
        profiles={profiles}
      />
    </div>
  );
}
