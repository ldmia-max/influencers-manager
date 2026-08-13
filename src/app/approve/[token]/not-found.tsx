import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function ApproveNotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-6 w-6" />
            <CardTitle>Enlace no válido</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            El enlace de aprobación que has utilizado no es válido o no existe.
          </p>
          <p className="text-sm text-muted-foreground">
            Por favor, verifica el enlace que recibiste o contacta al gestor de
            la campaña para solicitar un nuevo enlace de aprobación.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
