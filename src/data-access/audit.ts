import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Consulta del registro de auditoria.
 *
 * Sin cache a proposito: una auditoria que muestra el estado de hace
 * una hora no sirve para lo que se suele consultar, que es "que acaba
 * de pasar aqui".
 */
export async function getAuditLog(params: {
  action?: string;
  actorEmail?: string;
  entityId?: string;
  page: number;
  pageSize: number;
}) {
  const where: Prisma.AuditLogWhereInput = {
    ...(params.action ? { action: params.action } : {}),
    ...(params.actorEmail
      ? { actorEmail: { contains: params.actorEmail, mode: "insensitive" as const } }
      : {}),
    ...(params.entityId ? { entityId: params.entityId } : {}),
  };

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { entries, total, totalPages: Math.ceil(total / params.pageSize) };
}

/** Acciones presentes, para poblar el filtro sin inventarse la lista. */
export async function getAuditActions() {
  const filas = await prisma.auditLog.groupBy({
    by: ["action"],
    _count: { action: true },
    orderBy: { action: "asc" },
  });
  return filas.map((f) => ({ action: f.action, total: f._count.action }));
}
