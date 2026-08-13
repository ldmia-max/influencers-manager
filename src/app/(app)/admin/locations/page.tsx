import {
  getAllCountriesWithCounts,
  getAllDepartmentsWithCountries,
  getAllCitiesWithDepartments,
} from "@/data-access/locations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateCountryForm } from "@/components/forms/create-country-form";
import { CreateDepartmentForm } from "@/components/forms/create-department-form";
import { CreateCityForm } from "@/components/forms/create-city-form";
import { ToggleCountryButton } from "@/components/admin/toggle-country-button";
import { EditCountryDialog } from "@/components/admin/edit-country-dialog";
import { DeleteCountryButton } from "@/components/admin/delete-country-button";
import { DepartmentsTable } from "@/components/admin/departments-table";
import { CitiesTable } from "@/components/admin/cities-table";

export default async function LocationsPage() {
  const [countries, departments, cities] = await Promise.all([
    getAllCountriesWithCounts(),
    getAllDepartmentsWithCountries(),
    getAllCitiesWithDepartments(),
  ]);

  // Prepare data for forms
  const countriesForForm = countries.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
  }));

  const departmentsForForm = departments.map((d) => ({
    id: d.id,
    name: d.name,
    countryId: d.country.id,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Gestión de Ubicaciones</h1>

      <Tabs defaultValue="countries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="countries">
            Países ({countries.length})
          </TabsTrigger>
          <TabsTrigger value="departments">
            Departamentos ({departments.length})
          </TabsTrigger>
          <TabsTrigger value="cities">
            Ciudades ({cities.length})
          </TabsTrigger>
        </TabsList>

        {/* Countries Tab */}
        <TabsContent value="countries">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Nuevo País</CardTitle>
              </CardHeader>
              <CardContent>
                <CreateCountryForm />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Países Registrados</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Departamentos</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {countries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-500">
                          No hay países registrados
                        </TableCell>
                      </TableRow>
                    ) : (
                      countries.map((country) => (
                        <TableRow key={country.id}>
                          <TableCell className="font-medium">
                            {country.name}
                          </TableCell>
                          <TableCell className="text-gray-500">
                            {country.code}
                          </TableCell>
                          <TableCell>{country._count.departments}</TableCell>
                          <TableCell>
                            <Badge variant={country.isActive ? "default" : "secondary"}>
                              {country.isActive ? "Activo" : "Inactivo"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <EditCountryDialog
                                country={{
                                  id: country.id,
                                  name: country.name,
                                  code: country.code,
                                }}
                              />
                              <ToggleCountryButton
                                id={country.id}
                                isActive={country.isActive}
                              />
                              <DeleteCountryButton
                                id={country.id}
                                hasDepartments={country._count.departments > 0}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Nuevo Departamento</CardTitle>
              </CardHeader>
              <CardContent>
                <CreateDepartmentForm countries={countriesForForm} />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Departamentos Registrados</CardTitle>
              </CardHeader>
              <CardContent>
                <DepartmentsTable
                  departments={departments}
                  countries={countriesForForm}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Cities Tab */}
        <TabsContent value="cities">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Nueva Ciudad</CardTitle>
              </CardHeader>
              <CardContent>
                <CreateCityForm
                  countries={countriesForForm}
                  departments={departmentsForForm}
                />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Ciudades Registradas</CardTitle>
              </CardHeader>
              <CardContent>
                <CitiesTable
                  cities={cities}
                  countries={countriesForForm}
                  departments={departmentsForForm}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
