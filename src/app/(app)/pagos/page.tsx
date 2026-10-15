import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { puede, type Rol } from "@/lib/permissions";
import {
  agruparPorCampana,
  listarPagos,
  presupuestosDeCampanas,
} from "@/data-access/pagos";
import { formatNumber } from "@/lib/format";
import type { EstadoPago } from "@/lib/pagos";
import { FiltrosPagos } from "@/components/pagos/filtros-pagos";
import { TablaContabilidad } from "@/components/pagos/tabla-contabilidad";

/**
 * Control de pagos, de todas las campanas.
 *
 * Contabilidad trabaja por campana —cada cuadro de su hoja es una— y
 * compara el total de saldos con el presupuesto para no pasarse. Esta
 * es esa vista; la pestana dentro de la campana es la de mercadeo.
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
          Lo que hay que pagar a los influencers, campaña por campaña
        </p>
      </div>

      <Suspense fallback={<p className="text-sm text-gray-500">Cargando pagos…</p>}>
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

  const grupos = agruparPorCampana(pagos);
  // El presupuesto se mide contra lo que ve el cliente —base + 40%—, no
  // contra el coste: ese 40% es parte de lo contratado. Y lo que haya
  // que girar a los influencers tiene que caber dentro, siempre.
  const presupuestos = await presupuestosDeCampanas(grupos.map((g) => g.campanaId));
  for (const g of grupos) {
    g.presupuesto = presupuestos.get(g.campanaId) ?? 0;
    g.disponible = g.presupuesto - g.consumido;
    g.excedido = g.presupuesto > 0 && g.aPagar >= g.presupuesto;
  }

  // Las opciones de los desplegables salen de lo que hay, no de un
  // catalogo entero: un cliente sin campanas en marcha no tiene pagos y
  // ofrecerlo seria ofrecer una lista vacia.
  const todos = await listarPagos({});
  const clientes = [...new Map(todos.map((p) => [p.clienteId, p.cliente])).entries()]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  const meses = [...new Set(todos.map((p) => p.mesCampana).filter(Boolean))]
    .sort()
    .reverse() as string[];

  const saldo = pagos.reduce((s, p) => s + p.saldo, 0);
  const porVencer = pagos.filter((p) => p.avisar && p.estado !== "PAGADO").length;

  return (
    <div className="space-y-4">
      <FiltrosPagos clientes={clientes} meses={meses} />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span className="text-gray-500">
          {pagos.length} pago{pagos.length === 1 ? "" : "s"} en {grupos.length}{" "}
          campaña{grupos.length === 1 ? "" : "s"}
        </span>
        <span className="text-gray-500">
          Falta pagar:{" "}
          <span className="font-semibold text-gray-900">
            ${formatNumber(Math.round(saldo))}
          </span>
        </span>
        {porVencer > 0 && (
          <span className="font-medium text-red-600">
            {porVencer} con el plazo encima
          </span>
        )}
      </div>

      <TablaContabilidad grupos={grupos} puedeRegistrar={puedeRegistrar} />

      <p className="text-[11px] text-gray-500">
        El precio es lo pactado con el influencer, sin el 40% que se le carga
        al cliente. Los impuestos se calculan según cómo factura cada uno:
        natural sin IVA y 10% de retención, jurídica con IVA del 19% y 11% de
        retención, los dos sobre la base. El reteiva no aplica.
      </p>
    </div>
  );
}
