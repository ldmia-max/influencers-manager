import { Download, Eye } from "lucide-react";
import type { AbonoVista } from "@/data-access/pagos";

/**
 * Ver o descargar el comprobante de pago, al lado del estado.
 *
 * Va dentro de la celda de Estado y no en una columna propia: solo
 * tiene algo que decir cuando el influencer ya esta pagado, asi que una
 * columna entera estaria vacia en casi todas las filas y estrecharia las
 * demas. Dos iconos en linea con la etiqueta no hacen crecer la fila ni
 * hacia el lado ni hacia abajo.
 *
 * Contabilidad hace un solo pago por influencer, asi que lo normal es
 * un comprobante. Si alguna vez hubiera varios, salen todos.
 */
export function ComprobanteDePago({
  abonos,
  pagado,
}: {
  abonos: AbonoVista[];
  pagado: boolean;
}) {
  const conComprobante = abonos.filter((a) => a.comprobante);

  if (conComprobante.length === 0) {
    // Pagado sin comprobante: los pagos anotados antes de que existiera.
    // Se dice en vez de callar, para que nadie lo busque.
    return pagado ? (
      <span className="text-[11px] text-gray-400">sin comprobante</span>
    ) : null;
  }

  return (
    <span className="inline-flex items-center gap-0.5">
      {conComprobante.map((a) => {
        const nombre = a.comprobante!.nombre || "comprobante";
        return (
          <span key={a.id} className="inline-flex items-center">
            <a
              href={a.comprobante!.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`Ver comprobante: ${nombre}`}
              aria-label={`Ver comprobante: ${nombre}`}
              className="inline-flex h-6 w-6 items-center justify-center rounded text-violet-700 hover:bg-violet-50"
            >
              <Eye className="h-3.5 w-3.5" />
            </a>
            <a
              href={a.comprobante!.url}
              download={nombre}
              title={`Descargar comprobante: ${nombre}`}
              aria-label={`Descargar comprobante: ${nombre}`}
              className="inline-flex h-6 w-6 items-center justify-center rounded text-violet-700 hover:bg-violet-50"
            >
              <Download className="h-3.5 w-3.5" />
            </a>
          </span>
        );
      })}
    </span>
  );
}
