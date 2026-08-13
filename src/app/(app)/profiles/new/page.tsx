import { ProfileForm } from "@/components/forms/profile-form";
import {
  getCachedPlatforms,
  getCachedCategories,
  getCachedServiceTypes,
  getCachedGenders,
  getCachedCountries,
} from "@/lib/cache";
import { connection } from "next/server";

export default async function NewProfilePage() {
  await connection();

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
        platforms={platforms}
        serviceTypes={serviceTypes}
        categories={categories}
        genders={genders}
        countries={countries}
      />
    </div>
  );
}
