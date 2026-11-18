"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NavIcon, esRutaActiva } from "@/components/layout/sidebar";

/**
 * El menu del portal del cliente.
 *
 * Dos opciones y ninguna mas. No se filtra una tabla de permisos como
 * en el menu del personal porque aqui no hay roles que filtrar: un
 * ClientUser es siempre lo mismo y solo ve lo suyo. Enumerar las dos
 * rutas a mano deja a la vista, de un vistazo, toda la superficie que
 * el cliente puede abrir —que es justo lo que uno quiere poder
 * comprobar de un portal externo.
 *
 * Que una ruta no este aqui no la protege: lo que la protege es la
 * cookie firmada y el clientId en el where de cada consulta. Esto solo
 * decide lo que se pinta.
 */
const NAV = [
  { href: "/client-dashboard", label: "Campañas", icon: "megaphone" },
  { href: "/client-dashboard/revisiones", label: "Revisiones", icon: "file-text" },
];

/**
 * "/client-dashboard" es prefijo de todo lo demas, asi que por segmento
 * completo marcaria tambien Campañas estando en Revisiones. La raiz se
 * compara exacta; dentro de una campana (/client-dashboard/<id>) sigue
 * marcada Campañas, que es de donde se entro.
 */
function estaActiva(pathname: string, href: string): boolean {
  if (href !== "/client-dashboard") return esRutaActiva(pathname, href);
  return (
    pathname === href ||
    (pathname.startsWith("/client-dashboard/") &&
      !pathname.startsWith("/client-dashboard/revisiones"))
  );
}

/**
 * Menu en una franja bajo la cabecera, como el del personal, para que
 * las tablas anchas tengan toda la pantalla.
 *
 * A diferencia del personal, se muestra tambien en el movil: alli no hay
 * menu de hamburguesa, y estas dos opciones son toda la aplicacion —
 * esconderlas dejaria al cliente sin forma de llegar a Revisiones.
 */
export function PortalMenuSuperior() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="flex items-center gap-1 overflow-x-auto px-4 py-2 sm:px-6">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
              estaActiva(pathname, item.href)
                ? "bg-marca text-white"
                : "text-gray-600 hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <NavIcon name={item.icon} />
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
