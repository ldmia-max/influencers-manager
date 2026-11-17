"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientPagination } from "@/components/ui/client-pagination";
import { formatNumber } from "@/lib/format";
import { DIAS_DE_PLAZO, mesLegible } from "@/lib/pagos";
import type { GrupoDeCampana, PagoVista } from "@/data-access/pagos";
import { Dinero } from "@/components/pagos/piezas";
import { TablaPagos } from "@/components/pagos/tabla-contabilidad";

const VISTAS = ["influencers", "campanas", "meses"] as const;
type Vista = (typeof VISTAS)[number];

/**
 * Ya no hay nada que girarle: pagado del todo, o lo paga el cliente y
 * la agencia no le debe nada.
 */
function resuelto(p: PagoVista): boolean {
  return p.estado === "PAGADO" || p.loPagaElCliente;
}

/**
 * Lo mas urgente arriba: primero los que ya pasaron los 60 dias —el mas
 * atrasado el primero—, luego por los dias que les quedan, despues los
 * que aun no tienen cuenta de cobro y al final lo ya resuelto.
 */
function porUrgencia(pagos: PagoVista[]): PagoVista[] {
  const grupo = (p: PagoVista) => (resuelto(p) ? 2 : p.dias === null ? 1 : 0);
  return [...pagos].sort((a, b) => {
    const porGrupo = grupo(a) - grupo(b);
    if (porGrupo !== 0) return porGrupo;
    if (grupo(a) === 0) {
      const porDias = DIAS_DE_PLAZO - a.dias! - (DIAS_DE_PLAZO - b.dias!);
      if (porDias !== 0) return porDias;
    }
    return a.influencer.localeCompare(b.influencer, "es");
  });
}

/**
 * Control de pagos en tres vistas sobre los mismos datos.
 *
 * - Influencers: la lista de trabajo del dia, ordenada por lo que vence
 *   antes. Un influencer puede estar en varias campanas, asi que cada
 *   fila dice de cual es.
 * - Campanas: una fila por campana con su control contra el presupuesto,
 *   desplegable para operar sus pagos.
 * - Meses: las mismas campanas agrupadas por el mes al que se imputan,
 *   que es como mercadeo cierra el presupuesto.
 *
 * La pestana va en la URL (`?vista=`) para que un enlace abra la misma,
 * pero se cambia con history y no con el router: los datos son los
 * mismos en las tres y volver al servidor por cambiar de pestana seria
 * esperar para nada.
 */
export function VistaPagos({
  pagos,
  grupos,
  mesActual,
  puedeRegistrar,
  puedeEditarDocumentos,
  cabecera,
}: {
  pagos: PagoVista[];
  grupos: GrupoDeCampana[];
  /** "YYYY-MM" de hoy en la zona de la agencia. */
  mesActual: string;
  puedeRegistrar: boolean;
  puedeEditarDocumentos: boolean;
  /** El buscador y el resumen, que van fijos junto a las pestanas. */
  cabecera: React.ReactNode;
}) {
  const params = useSearchParams();
  const pedida = params.get("vista");
  const [vista, setVista] = useState<Vista>(
    VISTAS.includes(pedida as Vista) ? (pedida as Vista) : "influencers",
  );

  const cambiar = (v: string) => {
    setVista(v as Vista);
    const siguiente = new URLSearchParams(window.location.search);
    if (v === "influencers") siguiente.delete("vista");
    else siguiente.set("vista", v);
    const query = siguiente.toString();
    window.history.replaceState(
      null,
      "",
      query ? `?${query}` : window.location.pathname,
    );
  };

  const props = { puedeRegistrar, puedeEditarDocumentos };

  return (
    <Tabs value={vista} onValueChange={cambiar} className="gap-4">
      {/* Fijo arriba: con tablas tan largas, bajar a buscar el filtro o
          la pestana obligaba a volver a subir. */}
      <div className="sticky top-0 z-20 -mx-4 space-y-3 border-b border-gray-200 bg-gray-50/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <TabsList>
          <TabsTrigger value="influencers" className="px-4">
            Influencers
          </TabsTrigger>
          <TabsTrigger value="campanas" className="px-4">
            Campañas
          </TabsTrigger>
          <TabsTrigger value="meses" className="px-4">
            Meses
          </TabsTrigger>
        </TabsList>
        {cabecera}
      </div>

      {pagos.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-gray-500">
            No hay pagos con esos filtros.
          </CardContent>
        </Card>
      ) : (
        <>
          <TabsContent value="influencers">
            <PestanaInfluencers pagos={pagos} {...props} />
          </TabsContent>
          <TabsContent value="campanas">
            <PestanaCampanas grupos={grupos} {...props} />
          </TabsContent>
          <TabsContent value="meses">
            <PestanaMeses grupos={grupos} mesActual={mesActual} {...props} />
          </TabsContent>
        </>
      )}
    </Tabs>
  );
}

interface Permisos {
  puedeRegistrar: boolean;
  puedeEditarDocumentos: boolean;
}

function PestanaInfluencers({
  pagos,
  ...permisos
}: { pagos: PagoVista[] } & Permisos) {
  const ordenados = useMemo(() => porUrgencia(pagos), [pagos]);
  const [pagina, setPagina] = useState(1);
  const [tamano, setTamano] = useState(20);

  // Otro filtro, otra lista: volver a la primera pagina.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicio de paginacion intencionado
    setPagina(1);
  }, [pagos.length]);

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / tamano));
  const visibles = ordenados.slice((pagina - 1) * tamano, pagina * tamano);

  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <TablaPagos
          pagos={visibles}
          conCampana
          conTotales={false}
          {...permisos}
        />
        <ClientPagination
          currentPage={pagina}
          totalPages={totalPaginas}
          pageSize={tamano}
          total={ordenados.length}
          onPageChange={setPagina}
          onPageSizeChange={(t) => {
            setTamano(t);
            setPagina(1);
          }}
          pageSizeOptions={[10, 20, 50]}
        />
      </CardContent>
    </Card>
  );
}

/** De la mas reciente a la mas antigua: por mes de imputacion, y dentro
 * del mismo mes en el orden de creacion que ya trae la consulta. */
function porMesDesc(grupos: GrupoDeCampana[]): GrupoDeCampana[] {
  return [...grupos].sort((a, b) => (b.mes ?? "").localeCompare(a.mes ?? ""));
}

function PestanaCampanas({
  grupos,
  ...permisos
}: { grupos: GrupoDeCampana[] } & Permisos) {
  return (
    <Card>
      <CardContent className="pt-4">
        <TablaCampanas
          grupos={porMesDesc(grupos)}
          conMes
          {...permisos}
        />
      </CardContent>
    </Card>
  );
}

/**
 * El mes en curso primero y hacia atras hasta el mas antiguo. Si alguna
 * campana ya se imputo a un mes que todavia no llega, va al final: no
 * es lo que hay que pagar ahora.
 */
function PestanaMeses({
  grupos,
  mesActual,
  ...permisos
}: { grupos: GrupoDeCampana[]; mesActual: string } & Permisos) {
  const meses = useMemo(() => {
    const porMes = new Map<string, GrupoDeCampana[]>();
    for (const g of grupos) {
      const clave = g.mes ?? "";
      porMes.set(clave, [...(porMes.get(clave) ?? []), g]);
    }
    const claves = [...porMes.keys()];
    const pasados = claves
      .filter((m) => m <= mesActual)
      .sort()
      .reverse();
    const futuros = claves.filter((m) => m > mesActual).sort();
    return [...pasados, ...futuros].map((m) => ({
      mes: m,
      grupos: porMes.get(m)!,
    }));
  }, [grupos, mesActual]);

  return (
    <div className="space-y-4">
      {meses.map(({ mes, grupos: campanas }) => {
        const saldo = campanas.reduce((s, g) => s + g.saldo, 0);
        return (
          <Card key={mes}>
            <CardContent className="space-y-3 pt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold capitalize text-gray-900">
                  {mes ? mesLegible(mes) : "Sin mes"}
                  {mes === mesActual && (
                    <span className="ml-2 text-xs font-normal normal-case text-violet-700">
                      mes en curso
                    </span>
                  )}
                  {mes > mesActual && (
                    <span className="ml-2 text-xs font-normal normal-case text-gray-500">
                      próximo
                    </span>
                  )}
                </h2>
                <span className="flex gap-4 text-xs text-gray-500">
                  <span>
                    {campanas.length} campaña{campanas.length === 1 ? "" : "s"}
                  </span>
                  <span>
                    Falta pagar <Dinero valor={saldo} destacado />
                  </span>
                </span>
              </div>
              <TablaCampanas
                grupos={campanas}
                conMes={false}
                {...permisos}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function TablaCampanas({
  grupos,
  conMes,
  ...permisos
}: {
  grupos: GrupoDeCampana[];
  conMes: boolean;
} & Permisos) {
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const alternar = (id: string) =>
    setAbiertas((a) => {
      const b = new Set(a);
      if (b.has(id)) b.delete(id);
      else b.add(id);
      return b;
    });

  const columnas = [
    "Campaña",
    "Cliente",
    "Presupuesto",
    "Consumido",
    "Disponible",
    "A pagar a influencers",
    "Falta pagar",
    ...(conMes ? ["Mes"] : []),
    "Pagados",
  ];
  const numericas = new Set([
    "Presupuesto",
    "Consumido",
    "Disponible",
    "A pagar a influencers",
    "Falta pagar",
  ]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[64rem] bg-white text-xs">
        <thead>
          <tr className="text-gray-500">
            {columnas.map((c) => (
              <th
                key={c}
                className={`px-2 py-1 font-medium ${
                  numericas.has(c)
                    ? "text-right"
                    : c === "Pagados"
                      ? "text-center"
                      : "text-left"
                }`}
              >
                {c}
              </th>
            ))}
            <th className="w-8 px-2 py-1" />
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) => {
            const abierta = abiertas.has(g.campanaId);
            const pagados = g.pagos.filter(resuelto).length;
            const colorPagados =
              pagados === 0
                ? "border-red-200 bg-red-50 text-red-700"
                : pagados < g.pagos.length
                  ? "border-orange-200 bg-orange-50 text-orange-700"
                  : "border-green-200 bg-green-50 text-green-700";

            return (
              <Fragment key={g.campanaId}>
                <tr
                  className="cursor-pointer border-t border-gray-200/70 bg-white text-gray-600 hover:bg-gray-50"
                  onClick={() => alternar(g.campanaId)}
                  aria-expanded={abierta}
                >
                  <td className="px-2 py-2.5">
                    <Link
                      href={`/campaigns/${g.campanaId}`}
                      prefetch={false}
                      className="font-medium text-gray-900 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {g.campana}
                    </Link>
                  </td>
                  <td className="px-2 py-2.5">{g.cliente}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    <Dinero valor={g.presupuesto} destacado />
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    <Dinero valor={g.consumido} />
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    <Dinero valor={g.disponible} />
                  </td>
                  <td
                    className={`px-2 py-2.5 text-right tabular-nums ${
                      g.excedido ? "font-semibold text-red-600" : ""
                    }`}
                    title={
                      g.excedido
                        ? "No es menor que el presupuesto. Despliega la campaña para verlo."
                        : undefined
                    }
                  >
                    {g.excedido ? (
                      `$${formatNumber(Math.round(g.aPagar))}`
                    ) : (
                      <Dinero valor={g.aPagar} />
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    <span
                      className={
                        g.saldo === 0
                          ? "font-semibold text-green-700"
                          : "font-semibold text-gray-900"
                      }
                    >
                      ${formatNumber(Math.round(g.saldo))}
                    </span>
                  </td>
                  {conMes && (
                    <td className="whitespace-nowrap px-2 py-2.5 capitalize">
                      {g.mes ? mesLegible(g.mes) : "—"}
                    </td>
                  )}
                  <td className="px-2 py-2.5 text-center">
                    <span
                      className={`inline-block rounded-md border px-2 py-0.5 font-semibold tabular-nums ${colorPagados}`}
                      title={`${pagados} de ${g.pagos.length} influencers pagados`}
                    >
                      {pagados}/{g.pagos.length}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-gray-400">
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${abierta ? "rotate-180" : ""}`}
                    />
                  </td>
                </tr>

                {abierta && (
                  <tr className="bg-gray-50/60">
                    <td
                      colSpan={columnas.length + 1}
                      className="space-y-2 px-2 pb-4 pt-1"
                    >
                      {/* No deberia pasar nunca: el presupuesto cubre
                          base + 43% y el pago es como mucho base + 19%.
                          Si pasa, algo se contrato fuera de cuenta. */}
                      {g.excedido && (
                        <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
                          {`Lo que hay que pagar a los influencers ($${formatNumber(
                            Math.round(g.aPagar),
                          )}) no es menor que el presupuesto de la campaña ($${formatNumber(
                            Math.round(g.presupuesto),
                          )}). Revísalo con mercadeo antes de girar.`}
                        </p>
                      )}
                      <div className="rounded-lg border border-gray-200 bg-white p-2">
                        <TablaPagos
                          pagos={porUrgencia(g.pagos)}
                          {...permisos}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
