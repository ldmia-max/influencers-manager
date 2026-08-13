import { auth } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ProfileFilters } from "@/components/filters/profile-filters";
import { Pagination } from "@/components/ui/pagination";
import {
  getCachedProfiles,
  getCachedPlatforms,
  getCachedCategories,
  getCachedServiceTypes,
  getCachedGenders,
  getCachedCountries,
  getCachedDepartments,
  getCachedCities,
} from "@/lib/cache";
import type { ProfileType } from "@prisma/client";
import { ProfileDetailSheet } from "@/components/profiles/profile-detail-sheet";
import { ProfileCardWithCart } from "@/components/profiles/profile-card-with-cart";
import type { ProfileWithServices } from "@/models/campaign";

interface SearchParams {
  search?: string;
  countryId?: string;
  departmentId?: string;
  cityId?: string;
  type?: ProfileType;
  gender?: string;
  platforms?: string;
  categories?: string;
  services?: string;
  minPrice?: string;
  maxPrice?: string;
  minEngagement?: string;
  maxEngagement?: string;
  page?: string;
  pageSize?: string;
}

export default async function ProfilesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const params = await searchParams;

  // Construir filtros
  const platformIds = params.platforms?.split(",").filter(Boolean);
  const categoryIds = params.categories?.split(",").filter(Boolean);
  const serviceIds = params.services?.split(",").filter(Boolean);
  const minPrice = params.minPrice ? parseFloat(params.minPrice) : undefined;
  const maxPrice = params.maxPrice ? parseFloat(params.maxPrice) : undefined;
  const minEngagement = params.minEngagement ? parseFloat(params.minEngagement) : undefined;
  const maxEngagement = params.maxEngagement ? parseFloat(params.maxEngagement) : undefined;
  const page = params.page ? parseInt(params.page) : 1;
  const pageSize = params.pageSize ? parseInt(params.pageSize) : 10;

  const isAdmin = session?.user.role === "ADMIN";
  const userId = session?.user.id || "";

  // Usar funciones cacheadas con paginación
  const result = await getCachedProfiles(userId, isAdmin, {
    search: params.search,
    countryId: params.countryId,
    departmentId: params.departmentId,
    cityId: params.cityId,
    type: params.type,
    genderId: params.gender,
    platformIds,
    categoryIds,
    serviceIds,
    minPrice,
    maxPrice,
    minEngagement,
    maxEngagement,
    page,
    pageSize,
  });

  const { profiles, total, totalPages } = result;

  // Obtener opciones para filtros (cacheadas)
  const [platforms, categories, serviceTypes, genders, countries, departments, cities] =
    await Promise.all([
      getCachedPlatforms(),
      getCachedCategories(),
      getCachedServiceTypes(),
      getCachedGenders(),
      getCachedCountries(),
      getCachedDepartments(),
      getCachedCities(),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Perfiles</h1>
        <Link href="/profiles/new">
          <Button>Nuevo Perfil</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filtros */}
        <div className="lg:col-span-1">
          <ProfileFilters
            platforms={platforms}
            categories={categories}
            serviceTypes={serviceTypes}
            genders={genders}
            countries={countries}
            departments={departments.map((d) => ({
              id: d.id,
              name: d.name,
              countryId: d.countryId,
            }))}
            cities={cities.map((c) => ({
              id: c.id,
              name: c.name,
              departmentId: c.departmentId,
            }))}
          />
        </div>

        {/* Lista de Perfiles */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>
                Lista de Perfiles
                {total > 0 && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    ({total} resultado{total !== 1 ? "s" : ""})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {profiles.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  {params.search ||
                  params.countryId ||
                  params.departmentId ||
                  params.cityId ||
                  params.type ||
                  params.gender ||
                  platformIds ||
                  categoryIds ||
                  serviceIds ||
                  minPrice ||
                  maxPrice ? (
                    <>
                      No se encontraron perfiles con los filtros aplicados.{" "}
                      <Link href="/profiles" className="text-blue-600 hover:underline">
                        Limpiar filtros
                      </Link>
                    </>
                  ) : (
                    <>
                      No hay perfiles creados aún.{" "}
                      <Link
                        href="/profiles/new"
                        className="text-blue-600 hover:underline"
                      >
                        Crea tu primer perfil
                      </Link>
                    </>
                  )}
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {profiles.map((profile) => (
                    <ProfileCardWithCart
                      key={profile.id}
                      profile={profile as ProfileWithServices}
                      isAdmin={isAdmin}
                    />
                  ))}
                </div>
              )}

              {/* Paginación */}
              {profiles.length > 0 && (
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  total={total}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Panel lateral para ver detalles del perfil */}
      <ProfileDetailSheet />
    </div>
  );
}
