import { ProfileForm } from "@/components/forms/profile-form";
import {
  getCachedPlatforms,
  getCachedCategories,
  getCachedServiceTypes,
  getCachedGenders,
  getCachedCountries,
} from "@/lib/cache";
import { connection } from "next/server";

export default async function NewProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ nombre?: string; usuario?: string; plataforma?: string }>;
}) {
  await connection();
  // La busqueda con IA enlaza aqui con los datos del prospecto, para que
  // el alta se complete con tipo, categorias y precios antes de guardar.
  const prefill = await searchParams;

  const [platforms, serviceTypes, categories, genders, countries] = await Promise.all([
    getCachedPlatforms(),
    getCachedServiceTypes(),
    getCachedCategories(),
    getCachedGenders(),
    getCachedCountries(),
  ]);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo Perfil</h1>
      <ProfileForm
        key={Date.now()}
        prefill={prefill}
        platforms={platforms}
        serviceTypes={serviceTypes}
        categories={categories}
        genders={genders}
        countries={countries}
      />
    </div>
  );
}
