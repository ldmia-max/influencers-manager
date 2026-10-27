import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { puede, type Rol } from "@/lib/permissions";
import { ClientForm } from "@/components/forms/client-form";

export default async function NewClientPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // El middleware deja entrar a cualquiera con sesión: solo mira que la
  // haya, salvo en /admin. Sin esto, contabilidad —que solo lee
  // clientes— llegaba al formulario, lo rellenaba entero y se chocaba
  // con un 403 al guardar.
  if (!puede(session.user.role as Rol, "clientes", "crear")) {
    redirect("/clients");
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Nuevo Cliente</h1>
      <ClientForm />
    </div>
  );
}
