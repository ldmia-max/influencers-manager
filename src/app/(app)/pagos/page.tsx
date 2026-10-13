import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { puede, type Rol } from "@/lib/permissions";
import { listarPagos } from "@/data-access/pagos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import { mesLegible, type EstadoPago } from "@/lib/pagos";
import { FiltrosPagos } from "@/components/pagos/filtros-pagos";
import { RegistroContabilidad } from "@/components/pagos/registro-contabilidad";
import {
  Adjunto,
  EstadoBadge,
  Vencimiento,
} from "@/components/campaigns/pagos-campana";

/**
 * Control de pagos, de todas las campanas.
 *
 * Contabilidad no trabaja por campana sino por mes, asi que necesita
 * esta puerta ademas de la pestana que hay dentro de cada campana. Son
 * la misma informacion por dos recorridos distintos.
 *
 * La consulta vive dentro de <Suspense> y detras de connection():
 * `docker build` no tiene base de datos, y con cacheComponents una
 * pagina que consulte Prisma mientras se prerrenderiza rompe el build.
 */
export default async function PagosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pagos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Lo que hay que pagar a los influencers, de todas las campañas
        </p>
      </div>

      <Suspense
        fallback={<p className="text-sm text-gray-500">Cargando pagos…</p>}
      >
        <Listado searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Listado({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await connection();

  const session = await auth();
  const rol = (session?.user.role ?? "USER") as Rol;
  if (!puede(rol, "pagos", "leer")) redirect("/dashboard");

  const filtros = await searchParams;
  const puedeRegistrar = puede(rol, "pagos", "borrar");

  const pagos = await listarPagos({
    clientId: filtros.cliente,
    campaignId: filtros.campana,
    mes: filtros.mes,
    estado: filtros.estado as EstadoPago | undefined,
    soloVencidos: filtros.vencidos === "1",
    texto: filtros.texto,
  });

  // Las opciones de los desplegables salen de lo que hay, no de un
  // catalogo entero: un cliente sin campanas en marcha no tiene pagos
  // y ofrecerlo seria ofrecer una lista vacia.
  const todos = await listarPagos({});
  const clientes = [...new Map(todos.map((p) => [p.clienteId, p.cliente])).entries()]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  const meses = [...new Set(todos.map((p) => p.mes).filter(Boolean))]
    .sort()
    .reverse() as string[];

  const total = pagos.reduce((s, p) => s + p.base, 0);
  const vencidos = pagos.filter((p) => p.vencido).length;

  // Se agrupa por mes porque es como contabilidad mira su trabajo. Lo
  // que todavia no tiene cuenta de cobro no tiene mes, y va al final.
  const porMes = new Map<string, typeof pagos>();
  for (const p of pagos) {
    const clave = p.mes ?? "";
    porMes.set(clave, [...(porMes.get(clave) ?? []), p]);
  }
  const grupos = [...porMes.entries()].sort((a, b) =>
    a[0] === "" ? 1 : b[0] === "" ? -1 : b[0].localeCompare(a[0])
  );

  return (
    <div className="space-y-4">
      <FiltrosPagos clientes={clientes} meses={meses} />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span className="text-gray-500">
          {pagos.length} pago{pagos.length === 1 ? "" : "s"}
        </span>
        <span className="text-gray-500">
          Total contratado:{" "}
          <span className="font-semibold text-gray-900">
            ${formatNumber(total.toFixed(0))}
          </span>
        </span>
        {vencidos > 0 && (
          <span className="font-medium text-red-600">
            {vencidos} vencido{vencidos === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {pagos.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-gray-500">
            No hay pagos con esos filtros.
          </CardContent>
        </Card>
      ) : (
        grupos.map(([mes, filas]) => (
          <Card key={mes || "sin-mes"}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
              <CardTitle className="text-base first-letter:uppercase">
                {mes ? mesLegible(mes) : "Sin cuenta de cobro todavía"}
              </CardTitle>
              <span className="text-xs text-gray-500">
                {filas.length} · $
                {formatNumber(filas.reduce((s, p) => s + p.base, 0).toFixed(0))}
              </span>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[64rem] text-xs">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="px-2 py-1 font-medium">Influencer</th>
                      <th className="px-2 py-1 font-medium">Campaña</th>
                      <th className="px-2 py-1 font-medium">Cliente</th>
                      <th className="px-2 py-1 text-right font-medium">
                        Contratado
                      </th>
                      <th className="px-2 py-1 font-medium">Documentos</th>
                      <th className="px-2 py-1 font-medium">Fecha cuenta</th>
                      <th className="px-2 py-1 font-medium">Vence en</th>
                      <th className="px-2 py-1 font-medium">Documento</th>
                      <th className="px-2 py-1 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((p) => (
                      <tr
                        key={p.campaignProfileId}
                        className="border-t border-gray-200/70 align-top text-gray-600 odd:bg-marca/5"
                      >
                        <td className="px-2 py-2">
                          <p className="font-medium text-gray-900">
                            {p.influencer}
                          </p>
                          {p.nombreCompleto && (
                            <p className="text-[11px] text-gray-500">
                              {p.nombreCompleto}
                            </p>
                          )}
                          {p.documentoIdentidad && (
                            <p className="text-[11px] text-gray-400">
                              {p.documentoIdentidad}
                            </p>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <Link
                            href={`/campaigns/${p.campanaId}`}
                            prefetch={false}
                            className="text-violet-700 hover:underline"
                          >
                            {p.campana}
                          </Link>
                        </td>
                        <td className="px-2 py-2">{p.cliente}</td>
                        <td className="px-2 py-2 text-right font-medium tabular-nums text-gray-900">
                          ${formatNumber(p.base.toFixed(0))}
                        </td>
                        <td className="px-2 py-2">
                          <Adjunto
                            url={p.cuentaCobroUrl}
                            nombre={p.cuentaCobroNombre}
                            etiqueta="cuenta de cobro"
                          />
                          <Adjunto
                            url={p.certificadoUrl}
                            nombre={p.certificadoNombre}
                            etiqueta="certificado"
                          />
                        </td>
                        <td className="px-2 py-2">
                          {p.fechaCuentaCobro ? (
                            new Date(p.fechaCuentaCobro).toLocaleDateString("es-CO")
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <Vencimiento pago={p} />
                        </td>
                        <td className="px-2 py-2">
                          {puedeRegistrar ? (
                            <RegistroContabilidad
                              campaignProfileId={p.campaignProfileId}
                              documento={p.documento}
                              fechaCuentaCobro={p.fechaCuentaCobro}
                            />
                          ) : (
                            <span className={p.documento ? "" : "text-gray-400"}>
                              {p.documento || "sin registrar"}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <EstadoBadge estado={p.estado} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <p className="text-[11px] text-gray-500">
        El importe es lo contratado en la campaña, sin el margen del cliente.
        Los impuestos, el valor final y los abonos llegarán cuando mercadeo y
        contabilidad acuerden la fórmula.
      </p>
    </div>
  );
}
