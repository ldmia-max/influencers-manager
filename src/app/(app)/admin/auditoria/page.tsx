import { Suspense } from "react";
import { connection } from "next/server";
import { ShieldCheck } from "lucide-react";
import { getAuditLog, getAuditActions } from "@/data-access/audit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Registro de auditoria. Solo ADMIN: el layout de /admin ya lo exige.
 *
 * Es de SOLO LECTURA a proposito, sin borrar ni editar: un registro que
 * se puede alterar desde la propia aplicacion no prueba nada.
 */

const ETIQUETAS: Record<string, string> = {
  "auth.login_ok": "Acceso",
  "auth.login_failed": "Acceso fallido",
  "auth.locked": "Cuenta bloqueada",
  "campaign.status_changed": "Cambio de estado",
  "campaign.markup_changed": "Cambio de margen",
  "campaign.deleted": "Campaña eliminada",
  "approval.verified": "Cliente verificado",
  "approval.submitted": "Aprobación enviada",
  "profile.deleted": "Perfil eliminado",
  "client.deleted": "Cliente eliminado",
  "category.deleted": "Categoría eliminada",
  "user.created": "Usuario creado",
  "user.updated": "Usuario modificado",
  "user.deleted": "Usuario eliminado",
  "client.access_granted": "Acceso al portal concedido",
  "client.access_revoked": "Acceso al portal revocado",
};

const COLOR: Record<string, string> = {
  "auth.login_failed": "bg-amber-100 text-amber-800",
  "auth.locked": "bg-red-100 text-red-800",
  "campaign.deleted": "bg-red-100 text-red-800",
  "profile.deleted": "bg-red-100 text-red-800",
  "client.deleted": "bg-red-100 text-red-800",
  "category.deleted": "bg-red-100 text-red-800",
  "user.deleted": "bg-red-100 text-red-800",
  "approval.submitted": "bg-green-100 text-green-800",
};

type Filtros = { action?: string; actor?: string; page?: string };

function enlace(base: Filtros, cambios: Filtros) {
  const p = new URLSearchParams();
  const final = { ...base, ...cambios };
  if (final.action) p.set("action", final.action);
  if (final.actor) p.set("actor", final.actor);
  if (final.page) p.set("page", final.page);
  const q = p.toString();
  return q ? `/admin/auditoria?${q}` : "/admin/auditoria";
}

async function Contenido({
  searchParams,
}: {
  searchParams: Promise<Filtros>;
}) {
  await connection();
  const params = await searchParams;
  const page = params.page ? parseInt(params.page) : 1;

  const [{ entries, total, totalPages }, acciones] = await Promise.all([
    getAuditLog({
      action: params.action,
      actorEmail: params.actor,
      page,
      pageSize: 50,
    }),
    getAuditActions(),
  ]);

  const fecha = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "medium",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Auditoría
          <span className="ml-2 text-sm font-normal text-gray-500">
            {total} {total === 1 ? "evento" : "eventos"}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="mb-4 flex flex-wrap gap-2">
          <a
            href="/admin/auditoria"
            className={`rounded-full border px-3 py-1 text-xs ${
              params.action
                ? "border-gray-200 text-gray-600"
                : "border-gray-900 bg-gray-900 text-white"
            }`}
          >
            Todo
          </a>
          {acciones.map((a) => (
            <a
              key={a.action}
              href={enlace({}, { action: a.action })}
              className={`rounded-full border px-3 py-1 text-xs ${
                params.action === a.action
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              {ETIQUETAS[a.action] ?? a.action} ({a.total})
            </a>
          ))}
        </div>

        {entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            No hay eventos registrados todavía.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-gray-500">
                  <th className="py-2 pr-4 font-medium">Cuándo</th>
                  <th className="py-2 pr-4 font-medium">Acción</th>
                  <th className="py-2 pr-4 font-medium">Quién</th>
                  <th className="py-2 pr-4 font-medium">Qué</th>
                  <th className="py-2 font-medium">Origen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((e) => (
                  <tr key={e.id} className="align-top">
                    <td className="whitespace-nowrap py-2 pr-4 text-gray-500">
                      {fecha.format(e.createdAt)}
                    </td>
                    <td className="py-2 pr-4">
                      <Badge
                        variant="secondary"
                        className={COLOR[e.action] ?? "bg-gray-100 text-gray-800"}
                      >
                        {ETIQUETAS[e.action] ?? e.action}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4">
                      <div className="text-gray-900">{e.actorEmail ?? "—"}</div>
                      <div className="text-xs text-gray-400">{e.actorType}</div>
                    </td>
                    <td className="py-2 pr-4 text-gray-700">{e.summary ?? "—"}</td>
                    <td className="whitespace-nowrap py-2 text-xs text-gray-400">
                      {e.ip ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-gray-500">
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <a
                  href={enlace(params, { page: String(page - 1) })}
                  className="rounded-lg border px-3 py-1"
                >
                  Anterior
                </a>
              )}
              {page < totalPages && (
                <a
                  href={enlace(params, { page: String(page + 1) })}
                  className="rounded-lg border px-3 py-1"
                >
                  Siguiente
                </a>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<Filtros>;
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Auditoría</h1>
      <Suspense
        fallback={<div className="h-64 animate-pulse rounded-lg bg-gray-200" />}
      >
        <Contenido searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
