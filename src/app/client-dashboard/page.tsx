import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export default function ClientDashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Building2 className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Portal de Clientes</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bienvenido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Esta es el área de clientes. Próximamente podrás acceder a tus campañas,
              reportes y más información desde aquí.
            </p>
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Nota:</strong> Esta funcionalidad está en desarrollo. Por ahora
                solo tienes acceso a esta página de bienvenida.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
