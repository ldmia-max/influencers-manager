import { BusquedaIA } from "@/components/busqueda/busqueda-ia";

/**
 * Busqueda de prospectos con IA.
 *
 * Disponible para USER y ADMIN: buscar no crea nada, y el alta pasa por
 * el formulario de perfil de siempre, con sus permisos.
 */
export default function BusquedaIAPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Búsqueda con IA</h1>
        <p className="mt-1 text-sm text-gray-500">
          Encuentra creadores que todavía no están en la aplicación
        </p>
      </div>
      <BusquedaIA />
    </div>
  );
}
