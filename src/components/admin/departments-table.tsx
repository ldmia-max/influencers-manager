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
import { EditDepartmentDialog } from "./edit-department-dialog";
import { ToggleDepartmentButton } from "./toggle-department-button";
import { DeleteDepartmentButton } from "./delete-department-button";

interface Country {
  id: string;
  name: string;
  code: string;
}

interface Department {
  id: string;
  name: string;
  isActive: boolean;
  country: { id: string; name: string; code: string };
  _count: { cities: number };
}

interface DepartmentsTableProps {
  departments: Department[];
  countries: Country[];
}

const PAGE_SIZE = 10;

export function DepartmentsTable({ departments, countries }: DepartmentsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(departments.length / PAGE_SIZE) || 1;

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return departments.slice(start, start + PAGE_SIZE);
  }, [departments, currentPage]);

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>País</TableHead>
            <TableHead>Ciudades</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {departments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-gray-500">
                No hay departamentos registrados
              </TableCell>
            </TableRow>
          ) : (
            paginated.map((department) => (
              <TableRow key={department.id}>
                <TableCell className="font-medium">{department.name}</TableCell>
                <TableCell className="text-gray-500">
                  {department.country.name} ({department.country.code})
                </TableCell>
                <TableCell>{department._count.cities}</TableCell>
                <TableCell>
                  <Badge variant={department.isActive ? "default" : "secondary"}>
                    {department.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <EditDepartmentDialog
                      department={{
                        id: department.id,
                        name: department.name,
                        countryId: department.country.id,
                      }}
                      countries={countries}
                    />
                    <ToggleDepartmentButton
                      id={department.id}
                      isActive={department.isActive}
                    />
                    <DeleteDepartmentButton
                      id={department.id}
                      hasCities={department._count.cities > 0}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {departments.length > PAGE_SIZE && (
        <ClientPagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          total={departments.length}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}
