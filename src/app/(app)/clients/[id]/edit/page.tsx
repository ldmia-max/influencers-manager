import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { puede, type Rol } from "@/lib/permissions";
import { getClientForEdit } from "@/data-access/clients";
import { ClientForm } from "@/components/forms/client-form";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Aquí se gestionan también los contactos de la empresa, así que la
  // guardia es la misma que la de actualizar un cliente: administración
  // y mercadeo. El middleware solo comprueba que haya sesión.
  if (!puede(session.user.role as Rol, "clientes", "actualizar")) {
    redirect("/clients");
  }

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
