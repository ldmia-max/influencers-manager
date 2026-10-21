"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle } from "lucide-react";
import {
  comprobarEnlaceDeContrasena,
  establecerContrasenaDelPortal,
} from "@/services/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MINIMO = 6;

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">{children}</Card>
    </div>
  );
}

function Cabecera({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
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
        <span className="text-lg font-semibold text-gray-700">
          LDM People&apos;s
        </span>
      </div>
      <div>
        <CardTitle className="text-2xl">{titulo}</CardTitle>
        <CardDescription className="mt-2">{descripcion}</CardDescription>
      </div>
    </CardHeader>
  );
}

/**
 * Elegir contrasena con el enlace que llego por correo.
 *
 * El enlace se comprueba al abrir la pagina pero NO se gasta: algunos
 * clientes de correo precargan los enlaces de un mensaje, y gastarlo en
 * esa comprobacion lo quemaria antes de que nadie lo pulsara. Se gasta
 * al enviar el formulario.
 */
export function NuevaContrasenaForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");

  const enlace = useQuery({
    queryKey: ["enlace-contrasena-portal", token],
    queryFn: () => comprobarEnlaceDeContrasena(token),
    retry: false,
  });

  const mutacion = useMutation({
    mutationFn: () => establecerContrasenaDelPortal(token, password),
  });

  if (enlace.isPending) {
    return (
      <Marco>
        <CardContent className="py-16 text-center text-sm text-gray-500">
          Comprobando el enlace…
        </CardContent>
      </Marco>
    );
  }

  // El motivo concreto importa: dice si hay que pedir otro enlace, usar
  // el último correo recibido o hablar con la agencia.
  if (enlace.isError) {
    return (
      <Marco>
        <Cabecera
          titulo="Enlace no disponible"
          descripcion="No se puede elegir contraseña con este enlace."
        />
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-900">
              {enlace.error instanceof Error
                ? enlace.error.message
                : "Este enlace no es válido."}
            </p>
          </div>
          <Button asChild className="w-full">
            <Link href="/client-login/recuperar">Pedir un enlace nuevo</Link>
          </Button>
        </CardContent>
      </Marco>
    );
  }

  if (mutacion.isSuccess) {
    return (
      <Marco>
        <Cabecera
          titulo="Contraseña lista"
          descripcion="Ya puedes entrar al portal con tu correo y tu nueva contraseña."
        />
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border border-green-200 bg-green-50 px-3 py-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <p className="text-sm text-green-900">
              Tu contraseña quedó guardada.
            </p>
          </div>
          <Button className="w-full" onClick={() => router.push("/client-login")}>
            Entrar al portal
          </Button>
        </CardContent>
      </Marco>
    );
  }

  const corta = password.length > 0 && password.length < MINIMO;
  const distintas = confirmacion.length > 0 && password !== confirmacion;
  const valido = password.length >= MINIMO && password === confirmacion;

  return (
    <Marco>
      <Cabecera
        titulo="Elige tu contraseña"
        descripcion={`Para la cuenta de ${enlace.data.companyName}`}
      />
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (valido) mutacion.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="correo">Correo</Label>
            {/* Solo para que se vea de qué cuenta se trata: el enlace ya
                dice a quién pertenece y escribirlo no cambiaría nada. */}
            <Input id="correo" value={enlace.data.email} disabled readOnly />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Nueva contraseña</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={mutacion.isPending}
            />
            {corta && (
              <p className="text-xs text-red-600">
                Debe tener al menos {MINIMO} caracteres.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmacion">Repite la contraseña</Label>
            <Input
              id="confirmacion"
              type="password"
              required
              autoComplete="new-password"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              disabled={mutacion.isPending}
            />
            {distintas && (
              <p className="text-xs text-red-600">Las dos no coinciden.</p>
            )}
          </div>

          {mutacion.isError && (
            <p className="text-sm text-red-600">
              {mutacion.error instanceof Error
                ? mutacion.error.message
                : "No se pudo guardar la contraseña."}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!valido || mutacion.isPending}
          >
            {mutacion.isPending ? "Guardando…" : "Guardar contraseña"}
          </Button>
        </form>
      </CardContent>
    </Marco>
  );
}
