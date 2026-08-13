import { getAllReachRanges } from "@/data-access/reach-ranges";
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
import { CreateReachRangeForm } from "@/components/forms/create-reach-range-form";
import { ToggleReachRangeButton } from "@/components/admin/toggle-reach-range-button";
import { EditReachRangeDialog } from "@/components/admin/edit-reach-range-dialog";
import { DeleteReachRangeButton } from "@/components/admin/delete-reach-range-button";

function formatFollowers(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toString();
}

export default async function ReachRangesPage() {
  const reachRanges = await getAllReachRanges();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración de Alcance</h1>
        <p className="text-gray-500 mt-1">
          Define los rangos de seguidores y su porcentaje de alcance estimado
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Form */}
        <Card>
          <CardHeader>
            <CardTitle>Nuevo Rango</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateReachRangeForm />
          </CardContent>
        </Card>

        {/* Reach Ranges List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Rangos de Alcance</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Rango de Seguidores</TableHead>
                  <TableHead>% Alcance</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reachRanges.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500">
                      No hay rangos configurados. Los valores por defecto serán usados.
                    </TableCell>
                  </TableRow>
                ) : (
                  reachRanges.map((range) => (
                    <TableRow key={range.id}>
                      <TableCell className="font-medium">
                        {range.displayName}
                        <span className="text-xs text-gray-400 ml-1">({range.name})</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {formatFollowers(range.minFollowers)} -{" "}
                          {range.maxFollowers ? formatFollowers(range.maxFollowers) : "∞"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {range.reachPercentage}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={range.isActive ? "default" : "secondary"}>
                          {range.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <EditReachRangeDialog
                            reachRange={{
                              id: range.id,
                              name: range.name,
                              displayName: range.displayName,
                              minFollowers: range.minFollowers,
                              maxFollowers: range.maxFollowers,
                              reachPercentage: range.reachPercentage,
                            }}
                          />
                          <ToggleReachRangeButton
                            id={range.id}
                            isActive={range.isActive}
                          />
                          <DeleteReachRangeButton id={range.id} name={range.name} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Default values info */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">
                Valores por defecto (si no hay rangos activos):
              </h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Menos de 100K seguidores: <strong>40%</strong> de alcance</li>
                <li>• Entre 100K y 500K seguidores: <strong>30%</strong> de alcance</li>
                <li>• Mayor a 500K seguidores: <strong>20%</strong> de alcance</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
