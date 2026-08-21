"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Eye, Heart, Loader2, MessageCircle, RefreshCw, Share2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompactNumber, formatNumber } from "@/lib/format";
import { apiPost } from "@/services/api";

export interface CapturaMetrica {
  capturadoEn: string;
  vistas: number | null;
  meGusta: number | null;
  comentarios: number | null;
  compartidos: number | null;
  guardados: number | null;
  entregaId: string;
  influencer: string;
  plataforma: string;
  username: string;
}

interface Props {
  campaignId: string;
  capturas: CapturaMetrica[];
  /** El portal del cliente solo mira: no refresca ni gasta crédito. */
  puedeRefrescar?: boolean;
}

const SERIES = [
  { clave: "vistas" as const, nombre: "Vistas", color: "#7c3aed", icono: Eye },
  { clave: "meGusta" as const, nombre: "Me gusta", color: "#ec4899", icono: Heart },
  { clave: "comentarios" as const, nombre: "Comentarios", color: "#0ea5e9", icono: MessageCircle },
  { clave: "compartidos" as const, nombre: "Compartidos", color: "#22c55e", icono: Share2 },
];

function dia(iso: string): string {
  return iso.slice(0, 10);
}

export function MetricasCampana({ campaignId, capturas, puedeRefrescar = false }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const datos = useMemo(() => {
    // Ultima captura de cada entrega. Sumar todas las capturas contaria
    // varias veces la misma publicacion: las metricas son acumuladas, no
    // incrementos.
    const ultimaPorEntrega = new Map<string, CapturaMetrica>();
    for (const c of capturas) {
      const previa = ultimaPorEntrega.get(c.entregaId);
      if (!previa || c.capturadoEn > previa.capturadoEn) {
        ultimaPorEntrega.set(c.entregaId, c);
      }
    }
    const actuales = [...ultimaPorEntrega.values()];

    const totales = SERIES.map((s) => {
      // Si ninguna publicacion da el dato, no se muestra la tarjeta: un
      // cero se leeria como "nadie lo compartio", que es distinto de
      // "esta red no lo publica".
      const conDato = actuales.filter((c) => c[s.clave] !== null);
      return {
        ...s,
        valor: conDato.reduce((suma, c) => suma + (c[s.clave] ?? 0), 0),
        disponible: conDato.length > 0,
        cobertura: conDato.length,
      };
    });

    // Evolucion: total de la campana por dia, con la ultima captura de
    // cada entrega hasta ese dia.
    const dias = [...new Set(capturas.map((c) => dia(c.capturadoEn)))].sort();
    const evolucion = dias.map((d) => {
      const hasta = new Map<string, CapturaMetrica>();
      for (const c of capturas) {
        if (dia(c.capturadoEn) > d) continue;
        const previa = hasta.get(c.entregaId);
        if (!previa || c.capturadoEn > previa.capturadoEn) hasta.set(c.entregaId, c);
      }
      const vivas = [...hasta.values()];
      const fila: Record<string, string | number> = { dia: d.slice(5) };
      for (const s of SERIES) {
        fila[s.nombre] = vivas.reduce((suma, c) => suma + (c[s.clave] ?? 0), 0);
      }
      return fila;
    });

    // Reparto por influencer, para ver quien aporta que.
    const porInfluencer = new Map<string, { nombre: string; vistas: number; interacciones: number }>();
    for (const c of actuales) {
      const fila = porInfluencer.get(c.influencer) ?? {
        nombre: c.influencer,
        vistas: 0,
        interacciones: 0,
      };
      fila.vistas += c.vistas ?? 0;
      fila.interacciones +=
        (c.meGusta ?? 0) + (c.comentarios ?? 0) + (c.compartidos ?? 0);
      porInfluencer.set(c.influencer, fila);
    }

    return {
      totales,
      evolucion,
      porInfluencer: [...porInfluencer.values()].sort((a, b) => b.vistas - a.vistas),
      publicaciones: actuales.length,
      capturadoEn: actuales.length
        ? actuales.reduce((m, c) => (c.capturadoEn > m ? c.capturadoEn : m), "")
        : null,
    };
  }, [capturas]);

  const refrescar = async () => {
    setRefrescando(true);
    setError(null);
    try {
      await apiPost(`/api/campaigns/${campaignId}/metricas`, {});
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron refrescar");
    } finally {
      setRefrescando(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Impacto del contenido
          </CardTitle>
          {datos.capturadoEn && (
            <p className="mt-1 text-xs text-gray-500">
              {datos.publicaciones} publicaciones · última lectura{" "}
              {new Date(datos.capturadoEn).toLocaleString("es-CO", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
        {puedeRefrescar && (
          <Button size="sm" variant="outline" onClick={refrescar} disabled={refrescando}>
            {refrescando ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
            )}
            Actualizar
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {capturas.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">
              Todavía no hay métricas de los contenidos entregados.
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Se actualizan solas a diario durante el primer mes desde que se
              publica cada contenido.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {datos.totales
                .filter((t) => t.disponible)
                .map((t) => (
                  <div key={t.clave} className="rounded-lg bg-gray-50 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <t.icono className="h-3.5 w-3.5" style={{ color: t.color }} />
                      {t.nombre}
                    </div>
                    <p className="mt-1 text-xl font-semibold text-gray-900">
                      {formatNumber(t.valor)}
                    </p>
                    {t.cobertura < datos.publicaciones && (
                      <p className="text-[11px] text-gray-400">
                        de {t.cobertura} de {datos.publicaciones} publicaciones
                      </p>
                    )}
                  </div>
                ))}
            </div>

            {datos.totales.some((t) => !t.disponible) && (
              <p className="text-xs text-gray-400">
                {datos.totales
                  .filter((t) => !t.disponible)
                  .map((t) => t.nombre)
                  .join(" y ")}
                : ninguna de las redes de esta campaña publica ese dato.
              </p>
            )}

            {datos.evolucion.length > 1 && (
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">Evolución</p>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={datos.evolucion}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={formatCompactNumber} />
                    <Tooltip formatter={(v) => formatNumber(Number(v ?? 0))} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {datos.totales
                      .filter((t) => t.disponible)
                      .map((t) => (
                        <Line
                          key={t.clave}
                          type="monotone"
                          dataKey={t.nombre}
                          stroke={t.color}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {datos.porInfluencer.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">
                  Aporte por influencer
                </p>
                <ResponsiveContainer width="100%" height={Math.max(160, datos.porInfluencer.length * 46)}>
                  <BarChart data={datos.porInfluencer} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={formatCompactNumber} />
                    <YAxis
                      type="category"
                      dataKey="nombre"
                      width={140}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip formatter={(v) => formatNumber(Number(v ?? 0))} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="vistas" name="Vistas" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                    <Bar
                      dataKey="interacciones"
                      name="Interacciones"
                      fill="#ec4899"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
