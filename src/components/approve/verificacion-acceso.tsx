"use client";

import { useState } from "react";
import { Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiPost } from "@/services/api";

interface Props {
  token: string;
  campaignName: string;
  pistaCorreo: string;
  onVerificado: () => void;
}

/**
 * Puerta de acceso al portal de aprobacion.
 *
 * El enlace ya no basta: hay que demostrar que se controla el correo al
 * que se envio la campana. Se pide la direccion, se manda un codigo de
 * 6 digitos y solo entonces se abre la sesion.
 */
export function VerificacionAcceso({
  token,
  campaignName,
  pistaCorreo,
  onVerificado,
}: Props) {
  const [paso, setPaso] = useState<"correo" | "codigo">("correo");
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const pedirCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const r = await apiPost<{ message: string }>(
        `/api/public/approve/${token}/verificar`,
        { email: correo }
      );
      setAviso(r.message);
      setPaso("codigo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el código");
    } finally {
      setEnviando(false);
    }
  };

  const validarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await apiPost(`/api/public/approve/${token}/verificar`, { codigo });
      onVerificado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código incorrecto");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            {paso === "correo" ? (
              <Mail className="h-6 w-6 text-blue-600" />
            ) : (
              <ShieldCheck className="h-6 w-6 text-blue-600" />
            )}
          </div>
          <div>
            <CardTitle className="text-xl">{campaignName}</CardTitle>
            <CardDescription className="mt-2">
              {paso === "correo"
                ? "Para revisar esta campaña, confirma el correo al que te la enviamos."
                : "Introduce el código que acabamos de enviarte."}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {paso === "correo" ? (
            <form onSubmit={pedirCodigo} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="correo">Tu correo</Label>
                <Input
                  id="correo"
                  type="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder={pistaCorreo}
                  required
                  disabled={enviando}
                />
                <p className="text-xs text-gray-500">
                  Debe coincidir con la dirección a la que llegó la invitación.
                </p>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={enviando}>
                {enviando ? "Enviando..." : "Enviarme el código"}
              </Button>
            </form>
          ) : (
            <form onSubmit={validarCodigo} className="space-y-4">
              {aviso && <p className="text-sm text-gray-600">{aviso}</p>}
              <div className="space-y-2">
                <Label htmlFor="codigo">Código de 6 dígitos</Label>
                <Input
                  id="codigo"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={codigo}
                  onChange={(e) =>
                    setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="text-center font-mono text-2xl tracking-[0.4em]"
                  required
                  disabled={enviando}
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button
                type="submit"
                className="w-full"
                disabled={enviando || codigo.length !== 6}
              >
                {enviando ? "Comprobando..." : "Entrar"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={enviando}
                onClick={() => {
                  setPaso("correo");
                  setCodigo("");
                  setError(null);
                }}
              >
                Usar otro correo
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
