import { Suspense } from "react";
import { NuevaContrasenaForm } from "@/components/clients/nueva-contrasena-form";

/**
 * El token se espera AQUI, en el servidor, y baja como cadena.
 *
 * Con cacheComponents, los parametros de una ruta dinamica cuentan como
 * dato no cacheado igual que las cookies: leerlos con `use(params)`
 * dentro del componente de cliente rompia el build al prerenderizar
 * esta pagina con "Uncached data was accessed outside of <Suspense>".
 */
async function Cargador({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <NuevaContrasenaForm token={token} />;
}

export default function NuevaContrasenaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
          <p className="text-sm text-gray-500">Comprobando el enlace…</p>
        </div>
      }
    >
      <Cargador params={params} />
    </Suspense>
  );
}
