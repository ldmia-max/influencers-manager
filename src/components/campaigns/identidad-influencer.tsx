import { ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { urlDelPerfil } from "@/lib/social-handles";

export interface CuentaVisible {
  username: string;
  profilePicUrl?: string | null;
  platform: { name: string; displayName: string };
}

/**
 * Foto, nombre y enlaces a las redes de un creador, en la cabecera de su
 * tarjeta dentro de una campaña.
 *
 * La misma pieza para el personal y para el cliente: los dos miran la
 * misma tarjeta y quieren lo mismo de ella —ponerle cara al nombre y
 * poder abrir sus perfiles para conocerlo—, y dos copias acabarian
 * enlazando distinto.
 *
 * La foto es la que Apify guardó en la cuenta, la misma que sale en
 * Perfiles; se toma la primera red que tenga una. Los enlaces salen de
 * `urlDelPerfil`, el único constructor de URL de perfil: una red que no
 * sabe enlazar se muestra como texto en vez de un link roto.
 */
export function IdentidadInfluencer({
  nombre,
  cuentas,
  children,
}: {
  nombre: string;
  cuentas: CuentaVisible[];
  /** Lo que va debajo del nombre: ciudad, tipo, etc. */
  children?: React.ReactNode;
}) {
  const foto = cuentas.find((c) => c.profilePicUrl)?.profilePicUrl ?? "";

  return (
    <div className="flex min-w-0 items-start gap-3">
      <Avatar className="size-12">
        <AvatarImage src={foto} alt={`Foto de ${nombre}`} />
        <AvatarFallback>{nombre[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <h3 className="font-medium text-gray-900">{nombre}</h3>
        {children}
        {cuentas.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {cuentas.map((c) => {
              const url = urlDelPerfil(c.platform.name, c.username);
              const texto = (
                <>
                  @{c.username}
                  <span className="text-gray-400">· {c.platform.displayName}</span>
                </>
              );
              return url ? (
                <a
                  key={`${c.platform.name}-${c.username}`}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {texto}
                </a>
              ) : (
                <span
                  key={`${c.platform.name}-${c.username}`}
                  className="inline-flex items-center gap-1 text-xs text-gray-600"
                >
                  {texto}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
