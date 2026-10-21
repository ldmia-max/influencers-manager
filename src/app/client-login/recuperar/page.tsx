"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, MailCheck } from "lucide-react";
import { pedirEnlaceDeContrasena } from "@/services/auth";
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

/**
 * Pedir un enlace para elegir contrasena en el portal.
 *
 * Sirve tanto a quien la olvido como a quien nunca llego a tener una:
 * hasta ahora la unica forma de entrar era que un administrador se
 * inventara una contrasena y se la hiciera llegar al cliente por fuera
 * de la aplicacion.
 *
 * El mensaje de exito es el mismo exista el correo o no. No es descuido
 * ni pereza: si cambiara, este formulario seria una forma comoda de
 * averiguar que empresas son clientes de la agencia probando correos y
 * mirando cual contesta distinto.
 */
export default function RecuperarAccesoPage() {
  const [email, setEmail] = useState("");

  const mutacion = useMutation({
    mutationFn: () => pedirEnlaceDeContrasena(email),
  });

  const enviado = mutacion.isSuccess;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
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
            <span className="text-lg font-semibold text-gray-700">
              LDM People&apos;s
            </span>
          </div>
          <div>
            <CardTitle className="text-2xl">Acceso al portal</CardTitle>
            <CardDescription className="mt-2">
              Escribe tu correo y te enviaremos un enlace para elegir tu
              contraseña.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {enviado ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-md border border-green-200 bg-green-50 px-3 py-3">
                <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                <p className="text-sm text-green-900">
                  {mutacion.data?.mensaje ??
                    "Si ese correo tiene acceso al portal, te hemos enviado un enlace para elegir contraseña."}
                </p>
              </div>
              <p className="text-xs text-gray-500">
                Revisa también la carpeta de correo no deseado. El enlace caduca
                en 24 horas y solo puede usarse una vez.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/client-login">Volver a iniciar sesión</Link>
              </Button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutacion.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="email">Correo</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="cliente@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={mutacion.isPending}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={mutacion.isPending || !email.trim()}
              >
                {mutacion.isPending ? "Enviando…" : "Enviar enlace"}
              </Button>

              <Link
                href="/client-login"
                className="flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-gray-800"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver a iniciar sesión
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
