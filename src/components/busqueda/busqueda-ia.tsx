"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  ExternalLink,
  FileText,
  Heart,
  Search,
  Sparkles,
  UserPlus,
  Users,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCompactNumber } from "@/lib/format";
import { apiPost } from "@/services/api";

interface Prospecto {
  plataforma: string;
  username: string;
  nombre: string;
  bio: string;
  profileUrl: string;
  avatarUrl: string | null;
  verificado: boolean;
  seguidores: number;
  siguiendo: number | null;
  meGusta: number | null;
  publicaciones: number | null;
  cuentaPrivada: boolean;
  contexto: string | null;
  encaja: boolean;
  motivo: string;
  /** Id del perfil si ya esta dado de alta; null si es un prospecto nuevo. */
  yaRegistrado: string | null;
}

interface Respuesta {
  criterios: { plataforma: string; interpretacion: string; consultas: string[] };
  prospectos: Prospecto[];
  aviso?: string;
}

/**
 * Ejemplos de redaccion. Son texto, no botones: estan para ensenar la
 * forma de la frase —plataforma, nicho, lugar, seguidores—, no para
 * lanzar busquedas ajenas a lo que el usuario venia a buscar.
 *
 * Uno por plataforma, para que se vea que la red se elige escribiendola.
 */
const EJEMPLOS = [
  "Influencers de fitness en Medellín en TikTok con más de 50 mil seguidores",
  "Creadoras de cocina colombiana en Instagram, entre 10k y 100k seguidores",
  "Canales de YouTube sobre tecnología en Colombia",
];

/** Etiqueta y color por plataforma, para distinguirlas de un vistazo. */
const PLATAFORMAS: Record<string, { nombre: string; clase: string }> = {
  tiktok: { nombre: "TikTok", clase: "bg-gray-900 text-white" },
  instagram: { nombre: "Instagram", clase: "bg-pink-100 text-pink-800" },
  youtube: { nombre: "YouTube", clase: "bg-red-100 text-red-800" },
  kick: { nombre: "Kick", clase: "bg-green-100 text-green-800" },
};

function etiquetaPlataforma(id: string) {
  return PLATAFORMAS[id] ?? { nombre: id, clase: "bg-gray-100 text-gray-800" };
}

/** Avatar con reserva: YouTube no devuelve la foto del canal. */
function Avatar({ p, tam }: { p: Prospecto; tam: string }) {
  if (p.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={p.avatarUrl}
        alt=""
        className={`${tam} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <div
      className={`${tam} flex shrink-0 items-center justify-center rounded-full bg-violet-100 font-semibold text-violet-700`}
    >
      {(p.nombre || p.username).charAt(0).toUpperCase()}
    </div>
  );
}

export function BusquedaIA() {
  const [prompt, setPrompt] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [detalle, setDetalle] = useState<Prospecto | null>(null);

  const buscar = async (texto: string) => {
    const consulta = texto.trim();
    if (consulta.length < 3) return;
    setCargando(true);
    setError(null);
    setDatos(null);
    try {
      setDatos(await apiPost<Respuesta>("/api/busqueda-ia", { prompt: consulta }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la búsqueda");
    } finally {
      setCargando(false);
    }
  };

  /** Lleva al alta de perfil con lo que ya sabemos del prospecto. */
  const enlaceDeAlta = (p: Prospecto) => {
    const q = new URLSearchParams({
      nombre: p.nombre || p.username,
      usuario: p.username,
      plataforma: p.plataforma,
    });
    return `/profiles/new?${q.toString()}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-violet-100 p-2">
              <Sparkles className="h-5 w-5 text-violet-600" />
            </div>
            <div className="text-sm text-gray-600">
              <p className="font-medium text-gray-900">
                Describe el creador que buscas
              </p>
              <p className="mt-1">
                Indica <strong>plataforma</strong>, <strong>categoría</strong>,{" "}
                <strong>ciudad o país</strong> y, si quieres, un rango de
                seguidores. Se busca en la red que escribas: TikTok, Instagram o
                YouTube.
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              buscar(prompt);
            }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ej: influencers de fitness en Medellín en TikTok con más de 50 mil seguidores"
              className="flex-1"
              disabled={cargando}
              maxLength={500}
            />
            <Button type="submit" disabled={cargando || prompt.trim().length < 3}>
              <Search className="mr-2 h-4 w-4" />
              {cargando ? "Buscando…" : "Buscar"}
            </Button>
          </form>

          <div className="text-xs text-gray-500">
            <p className="font-medium text-gray-600">Ejemplos:</p>
            <ul className="mt-1 space-y-0.5">
              {EJEMPLOS.map((e) => (
                <li key={e} className="italic">
                  «{e}»
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {cargando && (
        <div className="py-10 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-violet-600" />
          <p className="mt-3 text-sm text-gray-500">
            Interpretando la búsqueda y consultando la plataforma…
          </p>
          <p className="text-xs text-gray-400">Suele tardar entre 15 y 40 segundos.</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {datos && !cargando && (
        <div className="space-y-4">
          {datos.criterios.interpretacion && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
              {datos.criterios.plataforma && (
                <Badge
                  variant="secondary"
                  className={etiquetaPlataforma(datos.criterios.plataforma).clase}
                >
                  {etiquetaPlataforma(datos.criterios.plataforma).nombre}
                </Badge>
              )}
              <span>
                <span className="font-medium">Se buscó:</span>{" "}
                {datos.criterios.interpretacion}
                {datos.criterios.consultas.length > 0 && (
                  <span className="text-gray-400">
                    {" "}
                    — términos: {datos.criterios.consultas.join(", ")}
                  </span>
                )}
              </span>
            </div>
          )}

          {datos.aviso && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {datos.aviso}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {datos.prospectos.map((p) => (
              <button
                key={`${p.plataforma}-${p.username}`}
                type="button"
                onClick={() => setDetalle(p)}
                className={`rounded-xl border p-4 text-left transition hover:shadow-md ${
                  p.encaja ? "border-gray-200 bg-white" : "border-gray-200 bg-gray-50 opacity-70"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Avatar p={p} tam="h-12 w-12" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="truncate font-medium text-gray-900">
                        {p.nombre || p.username}
                      </span>
                      {p.verificado && (
                        <BadgeCheck className="h-4 w-4 shrink-0 text-blue-500" />
                      )}
                    </div>
                    <p className="truncate text-xs text-gray-500">@{p.username}</p>
                  </div>
                </div>

                <p className="mt-2 line-clamp-2 text-xs text-gray-600">
                  {p.bio || "Sin biografía"}
                </p>

                <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {formatCompactNumber(p.seguidores)}
                  </span>
                  {p.meGusta !== null && (
                    <span className="flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5" />
                      {formatCompactNumber(p.meGusta)}
                    </span>
                  )}
                  {p.publicaciones !== null && (
                    <span className="flex items-center gap-1">
                      <Video className="h-3.5 w-3.5" />
                      {formatCompactNumber(p.publicaciones)}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  <Badge
                    variant="secondary"
                    className={etiquetaPlataforma(p.plataforma).clase}
                  >
                    {etiquetaPlataforma(p.plataforma).nombre}
                  </Badge>
                  {p.yaRegistrado ? (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      Ya está en la aplicación
                    </Badge>
                  ) : !p.encaja ? (
                    <Badge variant="secondary" className="bg-gray-200 text-gray-700">
                      Encaja poco
                    </Badge>
                  ) : null}
                </div>
              </button>
            ))}
          </div>

          {datos.prospectos.length === 0 && !datos.aviso && (
            <p className="py-8 text-center text-sm text-gray-500">
              No se encontraron creadores con esos criterios.
            </p>
          )}
        </div>
      )}

      {/* Detalle */}
      <Dialog open={!!detalle} onOpenChange={(v) => !v && setDetalle(null)}>
        <DialogContent className="max-w-lg">
          {detalle && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar p={detalle} tam="h-14 w-14" />
                  <div>
                    <DialogTitle className="flex items-center gap-1">
                      {detalle.nombre || detalle.username}
                      {detalle.verificado && (
                        <BadgeCheck className="h-4 w-4 text-blue-500" />
                      )}
                    </DialogTitle>
                    <DialogDescription>
                      @{detalle.username} ·{" "}
                      {etiquetaPlataforma(detalle.plataforma).nombre}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                {detalle.contexto && (
                  <p className="flex items-start gap-2 text-xs text-gray-500">
                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {detalle.contexto}
                  </p>
                )}

                {detalle.bio && (
                  <p className="whitespace-pre-line text-sm text-gray-700">
                    {detalle.bio}
                  </p>
                )}

                {detalle.motivo && (
                  <div className="rounded-lg bg-violet-50 p-3 text-sm text-violet-900">
                    <span className="font-medium">Valoración: </span>
                    {detalle.motivo}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  {(
                    [
                      ["Seguidores", detalle.seguidores],
                      ["Me gusta", detalle.meGusta],
                      ["Publicaciones", detalle.publicaciones],
                      ["Siguiendo", detalle.siguiendo],
                    ] as [string, number | null][]
                  )
                    // Solo lo que la plataforma publica de verdad.
                    .filter(([, valor]) => valor !== null)
                    .map(([etiqueta, valor]) => (
                      <div key={etiqueta} className="rounded-lg bg-gray-50 p-2">
                        <p className="text-xs text-gray-500">{etiqueta}</p>
                        <p className="font-semibold text-gray-900">
                          {formatCompactNumber(valor as number)}
                        </p>
                      </div>
                    ))}
                </div>

                {detalle.cuentaPrivada && (
                  <p className="text-xs text-amber-700">
                    Es una cuenta privada: sus métricas pueden estar incompletas.
                  </p>
                )}

                <div className="flex flex-col gap-2 sm:flex-row">
                  <a
                    href={detalle.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button variant="outline" className="w-full">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Ver en {etiquetaPlataforma(detalle.plataforma).nombre}
                    </Button>
                  </a>

                  {detalle.yaRegistrado ? (
                    <Link href={`/profiles?view=${detalle.yaRegistrado}`} className="flex-1">
                      <Button variant="secondary" className="w-full">
                        Ver perfil en la aplicación
                      </Button>
                    </Link>
                  ) : (
                    <Link href={enlaceDeAlta(detalle)} className="flex-1">
                      <Button className="w-full">
                        <UserPlus className="mr-2 h-4 w-4" />
                        Añadir a la aplicación
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
