"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { clientLogin } from "@/services/auth";
import type { ClientLoginPayload } from "@/services/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * A donde se va tras identificarse.
 *
 * Solo se admite una ruta del propio portal. `destino` llega por la
 * barra de direcciones, asi que sin esta comprobacion bastaria un
 * enlace a /client-login?destino=https://otro-sitio para que la
 * aplicacion mandase alli a quien acaba de poner su contrasena,
 * avalando con su dominio una pagina que no es suya.
 *
 * Una ruta que empiece por "//" tambien sale del sitio —el navegador la
 * lee como "//host/ruta"—, de ahi que no baste con exigir que empiece
 * por "/".
 */
const DESTINOS_ADMITIDOS = ["/client-dashboard", "/api/client-portal/"];

function destinoSeguro(destino: string | null): string {
  if (!destino) return "/client-dashboard";
  if (destino.startsWith("//")) return "/client-dashboard";
  return DESTINOS_ADMITIDOS.some((ruta) => destino.startsWith(ruta))
    ? destino
    : "/client-dashboard";
}

export default function ClientLoginPage() {
  // useSearchParams necesita un limite de suspension: con
  // cacheComponents esta pagina es estatica y leer la query fuera de el
  // rompe el build.
  return (
    <Suspense fallback={<Formulario destino="/client-dashboard" />}>
      <ConDestino />
    </Suspense>
  );
}

function ConDestino() {
  const destino = destinoSeguro(useSearchParams().get("destino"));
  return <Formulario destino={destino} />;
}

function Formulario({ destino }: { destino: string }) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const loginMutation = useMutation({
    mutationFn: (payload: ClientLoginPayload) => clientLogin(payload),
    onSuccess: () => {
      // replace y no push: si el destino es la ruta que resuelve la
      // revision, el boton de atras devolveria al login ya resuelto.
      // Y una ruta de /api se navega con el navegador, no con el
      // router, que solo sabe de paginas.
      if (destino.startsWith("/api/")) {
        window.location.replace(destino);
        return;
      }
      router.replace(destino);
      router.refresh();
    },
  });

  const loading = loginMutation.isPending;
  const error = loginMutation.error?.message || null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="flex flex-col items-center gap-2">
            <Image
              src="/img/logo.png"
              alt="Los de Marketing"
              width={493}
              height={159}
              className="h-14 w-auto"
              priority
            />
            <span className="text-lg font-semibold text-gray-700">LDM People&apos;s</span>
          </div>
          <div>
            <CardTitle className="text-2xl">Portal de Clientes</CardTitle>
            <CardDescription className="mt-2">
              Ingresa tus credenciales para acceder
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@empresa.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                {/* Tambien es por donde se estrena el acceso, no solo
                    por donde se recupera: hasta ahora la unica forma de
                    tener contrasena era que un administrador se
                    inventara una y la hiciera llegar por fuera. */}
                <Link
                  href="/client-login/recuperar"
                  className="text-sm text-blue-600 hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Ingresando..." : "Ingresar"}
            </Button>

            <div className="mt-4 text-center text-sm text-gray-500">
              ¿Es tu primera vez?{" "}
              <Link
                href="/client-login/recuperar"
                className="text-blue-600 hover:underline"
              >
                Crea tu contraseña
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
