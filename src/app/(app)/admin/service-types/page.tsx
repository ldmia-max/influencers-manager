import { getAllServiceTypesWithCounts } from "@/data-access/service-types";
import { getActivePlatforms } from "@/data-access/platforms";
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
import { CreateServiceTypeForm } from "@/components/forms/create-service-type-form";
import { ToggleServiceTypeButton } from "@/components/admin/toggle-service-type-button";
import { EditServiceTypeDialog } from "@/components/admin/edit-service-type-dialog";
import { DeleteServiceTypeButton } from "@/components/admin/delete-service-type-button";

export default async function ServiceTypesPage() {
  const [serviceTypes, platforms] = await Promise.all([
    getAllServiceTypesWithCounts(),
    getActivePlatforms(),
  ]);

  const profileTypeLabels: Record<string, string> = {
    INFLUENCER: "Influencer",
    UGC: "UGC",
    BOTH: "Ambos",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Formatos</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Service Type Form */}
        <Card>
          <CardHeader>
            <CardTitle>Nuevo Formato</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateServiceTypeForm platforms={platforms} />
          </CardContent>
        </Card>

        {/* Service Types List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Formatos Registrados</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Formato</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Tipos de Perfil</TableHead>
                  <TableHead>En Uso</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {serviceTypes.map((serviceType) => (
                  <TableRow key={serviceType.id}>
                    <TableCell className="font-medium">
                      {serviceType.displayName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {serviceType.platform.displayName}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {serviceType.profileTypes.map((pt) => (
                          <Badge key={pt} variant="secondary" className="text-xs">
                            {profileTypeLabels[pt] || pt}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{serviceType._count.profileServices}</TableCell>
                    <TableCell>
                      <Badge
                        variant={serviceType.isActive ? "default" : "secondary"}
                      >
                        {serviceType.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <EditServiceTypeDialog
                          serviceType={{
                            id: serviceType.id,
                            name: serviceType.name,
                            displayName: serviceType.displayName,
                            profileTypes: serviceType.profileTypes,
                            platformName: serviceType.platform.displayName,
                          }}
                        />
                        <ToggleServiceTypeButton
                          id={serviceType.id}
                          isActive={serviceType.isActive}
                        />
                        <DeleteServiceTypeButton
                          id={serviceType.id}
                          hasServices={serviceType._count.profileServices > 0}
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
