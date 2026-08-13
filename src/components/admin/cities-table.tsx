"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClientPagination } from "@/components/ui/client-pagination";
import { EditCityDialog } from "./edit-city-dialog";
import { ToggleCityButton } from "./toggle-city-button";
import { DeleteCityButton } from "./delete-city-button";

interface Country {
  id: string;
  name: string;
  code: string;
}

interface Department {
  id: string;
  name: string;
  countryId: string;
}

interface City {
  id: string;
  name: string;
  isActive: boolean;
  department: {
    id: string;
    name: string;
    country: { id: string; name: string; code: string };
  };
}

interface CitiesTableProps {
  cities: City[];
  countries: Country[];
  departments: Department[];
}

const PAGE_SIZE = 10;

export function CitiesTable({ cities, countries, departments }: CitiesTableProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(cities.length / PAGE_SIZE) || 1;

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return cities.slice(start, start + PAGE_SIZE);
  }, [cities, currentPage]);

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Departamento</TableHead>
            <TableHead>País</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cities.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-gray-500">
                No hay ciudades registradas
              </TableCell>
            </TableRow>
          ) : (
            paginated.map((city) => (
              <TableRow key={city.id}>
                <TableCell className="font-medium">{city.name}</TableCell>
                <TableCell className="text-gray-500">{city.department.name}</TableCell>
                <TableCell className="text-gray-500">
                  {city.department.country.name} ({city.department.country.code})
                </TableCell>
                <TableCell>
                  <Badge variant={city.isActive ? "default" : "secondary"}>
                    {city.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <EditCityDialog
                      city={{
                        id: city.id,
                        name: city.name,
                        departmentId: city.department.id,
                      }}
                      countries={countries}
                      departments={departments}
                    />
                    <ToggleCityButton id={city.id} isActive={city.isActive} />
                    <DeleteCityButton id={city.id} />
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {cities.length > PAGE_SIZE && (
        <ClientPagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          total={cities.length}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}
