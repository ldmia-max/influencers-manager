import { soporteDeRed } from "@/lib/redes";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Check, X } from "lucide-react";

/**
 * Que sabe el codigo de esta red, dicho donde se crean las redes.
 *
 * Existe porque dar de alta una plataforma desde Administracion no
 * necesita despliegue —los formatos y los precios son datos— pero hay
 * una parte de cada red que si: sus dominios, la forma de sus URLs, su
 * actor de Apify. Facebook se creo asi y quedo a medias sin que nada lo
 * dijera: se podia contratar y pagar, y en cambio pegar un enlace suyo
 * respondia que no era una red reconocida, semanas despues y a quien no
 * habia creado la red.
 *
 * Avisa, no bloquea: una red sin soporte sigue sirviendo para contratar
 * y pagar, que es la mitad que mas urge.
 */
export function SoporteDeRed({
  nombre,
  conDetalle = false,
}: {
  /** El `SocialPlatform.name` (el slug), no el nombre visible. */
  nombre: string;
  /** Lista las carencias una a una, para el formulario de alta. */
  conDetalle?: boolean;
}) {
  const { nivel, carencias } = soporteDeRed(nombre);

  if (nivel === "completo") {
    return (
      <Badge className="gap-1 bg-green-100 text-green-800 hover:bg-green-100">
        <Check className="h-3 w-3" />
        Completo
      </Badge>
    );
  }

  const etiqueta =
    nivel === "ninguno" ? (
      <Badge className="gap-1 bg-red-100 text-red-800 hover:bg-red-100">
        <X className="h-3 w-3" />
        Sin soporte
      </Badge>
    ) : (
      <Badge className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
        <AlertTriangle className="h-3 w-3" />
        Parcial
      </Badge>
    );

  if (!conDetalle) {
    // Ancho fijo y texto que parte: sin esto la frase empuja la tabla y
    // se come la columna de acciones.
    return (
      <div className="w-56 space-y-1">
        {etiqueta}
        <ul className="list-disc space-y-0.5 whitespace-normal pl-4 text-xs text-muted-foreground">
          {carencias.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div
      className={`space-y-2 rounded-md border p-3 ${
        nivel === "ninguno"
          ? "border-red-200 bg-red-50"
          : "border-amber-200 bg-amber-50"
      }`}
    >
      {etiqueta}
      <ul className="list-disc space-y-1 pl-4 text-xs text-gray-700">
        {carencias.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <p className="text-xs text-gray-500">
        Puedes crearla igualmente. Para completarla hace falta tocar
        código: los dominios y la forma de sus URLs viven en{" "}
        <code className="rounded bg-white px-1">src/lib/redes.ts</code>.
      </p>
    </div>
  );
}
