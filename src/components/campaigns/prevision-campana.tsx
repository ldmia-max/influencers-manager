import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Lo previsto frente a lo conseguido.
 *
 * La prevision sale de los seguidores contratados por una cadena de
 * factores fijos; el resultado, de la ultima captura de cada entrega,
 * la misma de la que vive Impacto del contenido. Las dos cifras de
 * cada fila se miden igual, asi que la comparacion dice algo.
 */
export interface FilaPrevision {
  etiqueta: string;
  prevision: number;
  /**
   * Null cuando ninguna publicacion da el dato. No es cero: un cero
   * afirmaria que nadie vio ni comento nada, y lo que ocurre es que
   * ninguna red publica esa cifra.
   */
  resultado: number | null;
  nota?: string;
}

function multiplicador(resultado: number, prevision: number) {
  if (prevision <= 0) return null;
  return resultado / prevision;
}

export function PrevisionCampana({
  seguidores,
  filas,
}: {
  seguidores: number;
  filas: FilaPrevision[];
}) {
  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <span className="font-semibold">Previsión</span>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
            <span className="flex items-center gap-2 text-gray-500">
              Total seguidores:
              <span className="font-semibold text-gray-900">
                {formatNumber(seguidores)}
              </span>
            </span>
            <span className="flex items-center gap-1.5 text-gray-500">
              <span className="h-2.5 w-2.5 rounded-full bg-marca" />
              Resultado
            </span>
            <span className="flex items-center gap-1.5 text-gray-500">
              <span className="h-2.5 w-2.5 rounded-full bg-gray-400" />
              Previsión
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {filas.map((f) => {
            // Cada fila se escala con su propio maximo. Una sola escala
            // para todas dejaria los comentarios como una raya invisible
            // al lado de las visualizaciones, que son mil veces mayores.
            const escala = Math.max(f.prevision, f.resultado ?? 0, 1);
            const x =
              f.resultado === null ? null : multiplicador(f.resultado, f.prevision);

            return (
              <div
                key={f.etiqueta}
                className="grid grid-cols-1 items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,8rem)_1fr_auto]"
              >
                <span className="text-sm font-semibold">{f.etiqueta}</span>

                <div className="space-y-1.5">
                  {/* Resultado arriba, prevision debajo: lo conseguido
                      es lo que se viene a mirar. */}
                  {f.resultado === null ? (
                    <div className="flex h-4 items-center text-xs text-gray-400">
                      {f.nota ?? "Sin datos medidos"}
                    </div>
                  ) : (
                    <Barra
                      valor={f.resultado}
                      escala={escala}
                      className="bg-marca"
                    />
                  )}
                  <Barra
                    valor={f.prevision}
                    escala={escala}
                    className="bg-gray-300"
                    tenue
                  />
                </div>

                <span
                  className={cn(
                    "text-right text-xl font-bold tabular-nums",
                    x === null
                      ? "text-gray-300"
                      : x >= 1
                        ? "text-marca"
                        : "text-gray-400"
                  )}
                >
                  {x === null
                    ? "—"
                    : `${x.toLocaleString("es-CO", {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}x`}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function Barra({
  valor,
  escala,
  className,
  tenue,
}: {
  valor: number;
  escala: number;
  className: string;
  tenue?: boolean;
}) {
  const ancho = Math.max((valor / escala) * 100, valor > 0 ? 0.5 : 0);
  return (
    <div className="flex items-center gap-2">
      {/* La barra cede ancho a su cifra en vez de empujarla fuera: la
          mas larga de la fila llega casi al borde y el numero queda
          pegado a su punta, que es donde se busca. */}
      <div
        className={cn("h-4 shrink rounded-full", className)}
        style={{ width: `${ancho}%` }}
      />
      <span
        className={cn(
          "shrink-0 text-xs tabular-nums",
          tenue ? "text-gray-500" : "font-medium text-gray-900"
        )}
      >
        {formatNumber(Math.round(valor))}
      </span>
    </div>
  );
}
