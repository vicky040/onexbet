import { Prisma } from "@prisma/client";
import { prisma } from "./db";

type AuditInput = {
  adminId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
  meta?: Prisma.InputJsonValue;
};

/**
 * Records an admin action. Never throws into the caller: a failed audit
 * write must not roll back the operation the admin just performed.
 */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: input.adminId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary,
        meta: input.meta,
      },
    });
  } catch (error) {
    console.error("[audit] could not record action", input.action, error);
  }
}
