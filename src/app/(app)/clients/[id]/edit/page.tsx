import { notFound } from "next/navigation";
import { getClientForEdit } from "@/data-access/clients";
import { ClientForm } from "@/components/forms/client-form";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const client = await getClientForEdit(id);

  if (!client) {
    notFound();
  }

  const initialData = {
    id: client.id,
    companyName: client.companyName,
    nit: client.nit || "",
    email: client.email,
    contacts: client.contacts.map((contact) => ({
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.phone || "",
      email: contact.email,
      position: contact.position || "",
      isPrimary: contact.isPrimary,
    })),
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Editar Cliente</h1>
      <ClientForm initialData={initialData} />
    </div>
  );
}
