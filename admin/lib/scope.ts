import type { Admin } from "@prisma/client";
import { prisma } from "./db";
import { ApiError } from "./errors";
import { requireAdmin } from "./auth";

/**
 * What an admin is allowed to see.
 *
 * A super admin and an operator see the whole platform. A MASTER_ADMIN is an
 * agent on the Master plan, and sees only the agents they referred — so every
 * query they drive has to be narrowed to that set.
 */
export type AdminScope = {
  admin: Admin;
  isMaster: boolean;
  /** null means unrestricted; a list means "only these agents". */
  agentIds: string[] | null;
};

export async function adminScope(): Promise<AdminScope> {
  const admin = await requireAdmin();

  if (admin.role !== "MASTER_ADMIN") {
    return { admin, isMaster: false, agentIds: null };
  }

  if (!admin.agentId) {
    // A master panel account with no agent behind it can manage nobody.
    // Failing closed beats quietly showing the whole platform.
    throw ApiError.forbidden(
      "This master account is not linked to an agent. Ask a super admin to fix it.",
    );
  }

  const referrals = await prisma.agent.findMany({
    where: { referredById: admin.agentId },
    select: { id: true },
  });

  return { admin, isMaster: true, agentIds: referrals.map((a) => a.id) };
}

/** Narrows a `where` clause to the agents this admin may see. */
export function scopedAgentWhere(scope: AdminScope) {
  return scope.agentIds === null ? {} : { id: { in: scope.agentIds } };
}

/** Same, for records that merely reference an agent. */
export function scopedByAgentId(scope: AdminScope) {
  return scope.agentIds === null ? {} : { agentId: { in: scope.agentIds } };
}

/** Throws unless this admin may act on the given agent. */
export function assertAgentInScope(scope: AdminScope, agentId: string) {
  if (scope.agentIds === null) return;
  if (!scope.agentIds.includes(agentId)) {
    throw ApiError.notFound("Agent");
  }
}
