"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/services/api";

/**
 * Cierre de sesion del portal de clientes.
 *
 * La cookie es httpOnly, asi que el navegador no puede borrarla por su
 * cuenta: hay que pedirselo al servidor. El refresh() posterior obliga
 * a revalidar el componente de servidor, o el usuario se quedaria
 * mirando sus campanas hasta recargar a mano.
 */
export function CerrarSesionCliente() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  const cerrarSesion = async () => {
    setSaliendo(true);
    try {
      await apiPost("/api/client-auth/logout");
      router.push("/client-login");
      router.refresh();
    } catch {
      // Si la peticion falla la sesion sigue viva; se devuelve el boton
      // a su estado para que se pueda reintentar.
      setSaliendo(false);
    }
  };

  return (
    <Button variant="outline" onClick={cerrarSesion} disabled={saliendo}>
      <LogOut className="mr-2 h-4 w-4" />
      {saliendo ? "Saliendo..." : "Cerrar sesión"}
    </Button>
  );
}
