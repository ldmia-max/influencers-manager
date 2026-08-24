import "server-only";
import { prisma } from "@/lib/prisma";
import type { AuditActor, Prisma } from "@prisma/client";

/**
 * Registro de auditoria: quien hizo que y cuando.
 *
 * Nace de un hueco concreto: si un cliente decia "yo no aprobe eso", no
 * habia forma de demostrar nada. Y como en esta aplicacion borrar es
 * fisico, una eliminacion no dejaba rastro alguno.
 *
 * No se registra todo. Un log de cada lectura y cada edicion menor se
 * vuelve ilegible y nadie lo mira. Se anotan los hechos que alguien
 * podria tener que reconstruir o discutir: accesos, cambios de estado
 * de campana, decisiones del cliente, cambios de dinero, borrados y
 * gestion de cuentas.
 */

interface EntradaAuditoria {
  action: string;
  entity: string;
  entityId?: string | null;
  actorType: AuditActor;
  actorId?: string | null;
  actorEmail?: string | null;
  summary?: string;
  metadata?: Prisma.InputJsonValue;
  /** Cabeceras de la peticion, si el punto de llamada las tiene. */
  req?: Request;
}

function ipDe(req?: Request): string | null {
  if (!req) return null;
  // Detras de Traefik la real es la primera de x-forwarded-for; el
  // resto son los proxies intermedios.
  const reenviada = req.headers.get("x-forwarded-for");
  if (reenviada) return reenviada.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

/**
 * Anota un hecho. NUNCA lanza.
 *
 * Si auditar fallara y esa excepcion subiera, un problema al escribir
 * el registro tumbaria la operacion que se estaba auditando: se
 * perderia el dato Y la accion. Preferimos perder la anotacion y
 * dejarla en el log del servidor.
 */
export async function auditar(entrada: EntradaAuditoria): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entrada.action,
        entity: entrada.entity,
        entityId: entrada.entityId ?? null,
        actorType: entrada.actorType,
        actorId: entrada.actorId ?? null,
        actorEmail: entrada.actorEmail ?? null,
        summary: entrada.summary,
        metadata: entrada.metadata,
        ip: ipDe(entrada.req),
        userAgent: entrada.req?.headers.get("user-agent")?.slice(0, 300) ?? null,
      },
    });
  } catch (error) {
    console.error("[auditoria] No se pudo registrar:", entrada.action, error);
  }
}

/** Acciones registradas, en un solo sitio para que no se inventen sobre la marcha. */
export const ACCIONES = {
  loginOk: "auth.login_ok",
  loginFallido: "auth.login_failed",
  cuentaBloqueada: "auth.locked",

  campanaEstado: "campaign.status_changed",
  campanaMargen: "campaign.markup_changed",

  aprobacionVerificada: "approval.verified",
  aprobacionEnviada: "approval.submitted",

  perfilBorrado: "profile.deleted",
  categoriaBorrada: "category.deleted",

  usuarioCreado: "user.created",
  usuarioModificado: "user.updated",
  usuarioBorrado: "user.deleted",

  accesoPortalConcedido: "client.access_granted",
  accesoPortalRevocado: "client.access_revoked",

  /// Retirar a un influencer cambia lo que cuesta la campana, asi que
  /// deja rastro igual que el margen.
  influencerRetirado: "campaign.influencer_withdrawn",
  influencerReactivado: "campaign.influencer_reinstated",
  influencerAnadido: "campaign.influencer_added",
  /// Aprobar en nombre del cliente un gasto que el no ha visto.
  influencerAprobadoPorAgencia: "campaign.influencer_approved_by_agency",
} as const;
