"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { clientLogin } from "@/services/auth";
import type { ClientLoginPayload } from "@/services/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ClientLoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const loginMutation = useMutation({
    mutationFn: (payload: ClientLoginPayload) => clientLogin(payload),
    onSuccess: () => {
      router.push("/client-dashboard");
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
