import { getAllPlatformsWithCounts } from "@/data-access/platforms";
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
import { CreatePlatformForm } from "@/components/forms/create-platform-form";
import { TogglePlatformButton } from "@/components/admin/toggle-platform-button";
import { EditPlatformDialog } from "@/components/admin/edit-platform-dialog";
import { DeletePlatformButton } from "@/components/admin/delete-platform-button";

export default async function PlatformsPage() {
  const platforms = await getAllPlatformsWithCounts();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Gestión de Plataformas</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Platform Form */}
        <Card>
          <CardHeader>
            <CardTitle>Nueva Plataforma</CardTitle>
          </CardHeader>
          <CardContent>
            <CreatePlatformForm />
          </CardContent>
        </Card>

        {/* Platforms List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Plataformas Registradas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Identificador</TableHead>
                  <TableHead>Cuentas</TableHead>
                  <TableHead>Formatos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {platforms.map((platform) => (
                  <TableRow key={platform.id}>
                    <TableCell className="font-medium">
                      {platform.displayName}
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {platform.name}
                    </TableCell>
                    <TableCell>{platform._count.accounts}</TableCell>
                    <TableCell>{platform._count.serviceTypes}</TableCell>
                    <TableCell>
                      <Badge variant={platform.isActive ? "default" : "secondary"}>
                        {platform.isActive ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <EditPlatformDialog
                          platform={{
                            id: platform.id,
                            name: platform.name,
                            displayName: platform.displayName,
                          }}
                        />
                        <TogglePlatformButton
                          id={platform.id}
                          isActive={platform.isActive}
                        />
                        <DeletePlatformButton
                          id={platform.id}
                          hasAccounts={platform._count.accounts > 0}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
