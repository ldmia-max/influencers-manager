import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import {
  COOKIE_SESION_CLIENTE,
  verificarSesionCliente,
} from "@/lib/client-session";
import { CerrarSesionCliente } from "@/components/clients/cerrar-sesion-cliente";
import {
  PortalSidebar,
  PortalNavMovil,
} from "@/components/clients/portal-sidebar";

/**
 * El armazon entero: cabecera, menu y contenido.
 *
 * Va completo dentro de un solo <Suspense>, igual que el layout del
 * personal, y no solo la cabecera. Con cacheComponents no basta con
 * envolver lo que lee cookies(): el menu usa usePathname(), y en una
 * ruta dinamica como /client-dashboard/[campaignId] la ruta no se
 * conoce al compilar, de modo que tambien cuenta como dato no cacheado.
 * Dejarlo fuera rompia el build con "Uncached data was accessed outside
 * of <Suspense>" al prerenderizar esa pagina.
 *
 * El redirect de aqui no sustituye al del middleware ni al de cada
 * pagina. El middleware decide si se entra; cada pagina vuelve a
 * verificar porque de ahi sale el clientId con el que consulta. Esto
 * solo evita pintar una cabecera vacia.
 */
async function Armazon({ children }: { children: React.ReactNode }) {
  const almacen = await cookies();
  const sesion = await verificarSesionCliente(
    almacen.get(COOKIE_SESION_CLIENTE)?.value
  );

  if (!sesion) {
    redirect("/client-login");
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2">
            <Building2 className="h-5 w-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-gray-900">
              {sesion.companyName}
            </p>
            <p className="truncate text-xs text-gray-500">{sesion.email}</p>
          </div>
        </div>
        <CerrarSesionCliente />
      </div>

      <PortalNavMovil />

      <div className="flex flex-1">
        <PortalSidebar />
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </>
  );
}

function ArmazonCargando() {
  return (
    <div aria-hidden>
      <div className="border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="h-10 w-64 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="p-4 sm:p-6">
        <div className="h-48 animate-pulse rounded-lg bg-gray-200" />
      </div>
    </div>
  );
}

/**
 * Armazon del portal del cliente.
 *
 * Deliberadamente separado del layout de (app): aquel monta la barra
 * del personal con su menu completo y lee la sesion de NextAuth, que
 * un ClientUser no tiene. Compartirlo obligaria a que cada opcion del
 * menu interno supiera esconderse del cliente, y la que se olvidara se
 * veria. Aqui solo existe lo que el cliente puede abrir.
 */
export default function ClientDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Suspense fallback={<ArmazonCargando />}>
        <Armazon>{children}</Armazon>
      </Suspense>
    </div>
  );
}
