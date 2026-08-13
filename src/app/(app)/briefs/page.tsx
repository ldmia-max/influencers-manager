import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCampaignBriefs } from "@/data-access/campaign-briefs";
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
import { ESTADO_BRIEF } from "@/components/briefs/estado-brief";
import { FileText } from "lucide-react";

export const metadata = { title: "Briefs recibidos" };

/** Pagina privada: vive en (app), cuyo layout exige sesion. */
export default function BriefsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Briefs recibidos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Formularios enviados por clientes desde{" "}
          <Link href="/brief" className="text-blue-600 hover:underline">
            /brief
          </Link>
        </p>
      </div>

      <Suspense fallback={<p className="text-sm text-gray-500">Cargando briefs…</p>}>
        <ListaBriefs />
      </Suspense>
    </div>
  );
}

async function ListaBriefs() {
  // Comprobacion propia, NO delegada al layout: con Cache Components el
  // redirect del layout vive en otro Suspense y este contenido se
  // transmitiria igualmente al cliente sin sesion.
  const session = await auth();
  if (!session?.user) redirect("/login");

  const briefs = await getCampaignBriefs();

  const formatoCOP = (valor: unknown) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(Number(valor));

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {briefs.length} brief{briefs.length !== 1 && "s"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {briefs.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-gray-500">Aún no se ha recibido ningún brief.</p>
            <p className="mt-1 text-sm text-gray-400">
              Comparte el enlace <strong>/brief</strong> con tus clientes.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaña</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Presupuesto</TableHead>
                <TableHead>Recibido</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {briefs.map((b) => {
                const estado = ESTADO_BRIEF[b.status];
                return (
                  <TableRow key={b.id} className="cursor-pointer hover:bg-gray-50">
                    <TableCell className="font-medium">
                      <Link href={`/briefs/${b.id}`} className="hover:underline">
                        {b.nombreCampana}
                      </Link>
                    </TableCell>
                    <TableCell>{b.empresa}</TableCell>
                    <TableCell className="text-sm">
                      <div>{b.responsable}</div>
                      <div className="text-gray-500">{b.correo}</div>
                    </TableCell>
                    <TableCell>{formatoCOP(b.presupuestoTotal)}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Intl.DateTimeFormat("es-CO", {
                        dateStyle: "medium",
                      }).format(b.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={estado.variant}>{estado.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
