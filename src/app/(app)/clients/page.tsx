import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Building2 } from "lucide-react";
import { DeleteClientDialog } from "@/components/clients/delete-client-dialog";
import { ManageAccessDialog } from "@/components/clients/manage-access-dialog";

interface SearchParams {
  search?: string;
  page?: string;
  pageSize?: string;
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const params = await searchParams;

  const page = params.page ? parseInt(params.page) : 1;
  const pageSize = params.pageSize ? parseInt(params.pageSize) : 10;
  const skip = (page - 1) * pageSize;

  const where = params.search
    ? {
        OR: [
          { companyName: { contains: params.search, mode: "insensitive" as const } },
          { email: { contains: params.search, mode: "insensitive" as const } },
          { nit: { contains: params.search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        contacts: {
          where: { isPrimary: true },
          take: 1,
        },
        _count: {
          select: { contacts: true },
        },
        clientUser: {
          select: {
            email: true,
            isActive: true,
          },
        },
      },
    }),
    prisma.client.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);
  const isAdmin = session?.user.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <Link href="/clients/new">
          <Button>Nuevo Cliente</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Lista de Clientes
            {total > 0 && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({total} cliente{total !== 1 ? "s" : ""})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {clients.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No hay clientes creados aún.{" "}
              <Link href="/clients/new" className="text-blue-600 hover:underline">
                Crea tu primer cliente
              </Link>
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>NIT</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Contacto Principal</TableHead>
                    <TableHead>Total Contactos</TableHead>
                    <TableHead>Estado Login</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => {
                    const primaryContact = client.contacts[0];

                    return (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-gray-400" />
                            {client.companyName}
                          </div>
                        </TableCell>
                        <TableCell>
                          {client.nit || <span className="text-gray-400">-</span>}
                        </TableCell>
                        <TableCell>{client.email}</TableCell>
                        <TableCell>
                          {primaryContact ? (
                            <div className="text-sm">
                              <div>
                                {primaryContact.firstName} {primaryContact.lastName}
                              </div>
                              <div className="text-gray-500">{primaryContact.email}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400">Sin contacto</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {client._count.contacts} contacto
                            {client._count.contacts !== 1 ? "s" : ""}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {client.clientUser ? (
                            <Badge
                              variant={
                                client.clientUser.isActive ? "default" : "secondary"
                              }
                            >
                              {client.clientUser.isActive ? "Activo" : "Inactivo"}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Sin acceso</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isAdmin && (
                              <ManageAccessDialog
                                clientId={client.id}
                                clientName={client.companyName}
                                currentAccess={
                                  client.clientUser
                                    ? {
                                        email: client.clientUser.email,
                                        isActive: client.clientUser.isActive,
                                      }
                                    : null
                                }
                              />
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  aria-label="Acciones"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/clients/${client.id}/edit`}
                                    className="flex items-center gap-2"
                                  >
                                    <Pencil className="h-4 w-4" />
                                    Editar
                                  </Link>
                                </DropdownMenuItem>
                                {isAdmin && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem>
                                      <div className="flex items-center gap-2 w-full">
                                        <DeleteClientDialog
                                          clientId={client.id}
                                          clientName={client.companyName}
                                        />
                                      </div>
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {clients.length > 0 && (
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  total={total}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
