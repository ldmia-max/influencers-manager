import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { ProfileForm } from "@/components/forms/profile-form";
import { getProfileForEdit } from "@/data-access/profiles";
import {
  getCachedPlatforms,
  getCachedCategories,
  getCachedServiceTypes,
  getCachedGenders,
  getCachedCountries,
} from "@/lib/cache";

export default async function EditProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await auth();
  const { id } = await params;

  // No cachear el perfil en edición para obtener los datos más recientes
  const [profile, platforms, serviceTypes, categories, genders, countries] = await Promise.all([
    getProfileForEdit(id).catch(() => null),
    getCachedPlatforms(),
    getCachedServiceTypes(),
    getCachedCategories(),
    getCachedGenders(),
    getCachedCountries(),
  ]);

  if (!profile) {
    notFound();
  }

  // Cualquier usuario autenticado puede editar perfiles

  // Transform profile data for form
  const initialData = {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    type: profile.type,
    countryId: profile.countryId,
    departmentId: profile.departmentId,
    cityId: profile.cityId,
    genderId: profile.genderId,
    socialAccounts: profile.socialAccounts.map((sa) => ({
      platformId: sa.platformId,
      username: sa.username,
      services: sa.services.map((s) => ({
        serviceTypeId: s.serviceTypeId,
        price: Number(s.price),
        currency: s.currency,
      })),
    })),
    categoryIds: profile.categories.map((pc) => pc.categoryId),
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar Perfil</h1>
      <ProfileForm
        platforms={platforms}
        serviceTypes={serviceTypes}
        categories={categories}
        genders={genders}
        countries={countries}
        initialData={initialData}
      />
    </div>
  );
}
