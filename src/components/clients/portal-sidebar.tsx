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

export function PortalSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 border-r border-gray-200 bg-white md:block">
      <nav className="space-y-1 p-4">
        {NAV.map((item) => {
          // "/client-dashboard" es prefijo de todo lo demas, asi que por
          // segmento completo marcaria tambien Campañas estando en
          // Revisiones. La raiz se compara exacta; dentro de una campana
          // (/client-dashboard/<id>) sigue marcada Campañas, que es de
          // donde se entro.
          const activa =
            item.href === "/client-dashboard"
              ? pathname === item.href ||
                (pathname.startsWith("/client-dashboard/") &&
                  !pathname.startsWith("/client-dashboard/revisiones"))
              : esRutaActiva(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                activa
                  ? "bg-marca text-white"
                  : "text-gray-600 hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

/**
 * El mismo menu en horizontal, para pantallas estrechas.
 *
 * El del personal simplemente desaparece por debajo de md y dentro de
 * la app se navega por otras vias. Aqui no hay otras vias: son dos
 * opciones y son toda la aplicacion, asi que esconderlas en el movil
 * dejaria al cliente sin forma de llegar a Revisiones.
 */
export function PortalNavMovil() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 border-b border-gray-200 bg-white px-4 py-2 md:hidden">
      {NAV.map((item) => {
        const activa =
          item.href === "/client-dashboard"
            ? pathname === item.href ||
              (pathname.startsWith("/client-dashboard/") &&
                !pathname.startsWith("/client-dashboard/revisiones"))
            : esRutaActiva(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              activa
                ? "bg-marca text-white"
                : "text-gray-600 hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <NavIcon name={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
