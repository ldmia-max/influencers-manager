import { ClientForm } from "@/components/forms/client-form";

export default function NewClientPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Nuevo Cliente</h1>
      <ClientForm />
    </div>
  );
}
