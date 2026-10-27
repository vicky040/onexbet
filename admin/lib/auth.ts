import { cookies } from "next/headers";
import type { Admin, Agent } from "@prisma/client";
import { prisma } from "./db";
import { ADMIN_COOKIE, env } from "./env";
import { ApiError } from "./errors";
import {
  bearerFrom,
  createRefreshToken,
  hashRefreshToken,
  signAgentAccessToken,
  verifyAdminSession,
  verifyAgentAccessToken,
} from "./tokens";

// ---------------------------------------------------------------------------
// Agents (Flutter app)
// ---------------------------------------------------------------------------

/** The authenticated agent, or an ApiError that `withRoute` turns into 401/403. */
export async function requireAgent(request: Request): Promise<Agent> {
  const token = bearerFrom(request);
  if (!token) {
    throw ApiError.unauthorized("Send an Authorization: Bearer <token> header");
  }

  const claims = await verifyAgentAccessToken(token);
  if (!claims) {
    throw ApiError.unauthorized("Your session has expired. Please log in again.");
  }

  const agent = await prisma.agent.findUnique({ where: { id: claims.agentId } });
  if (!agent) throw ApiError.unauthorized("This account no longer exists");

  assertAgentCanSignIn(agent);
  return agent;
}

export function assertAgentCanSignIn(agent: Agent) {
  if (agent.status === "BLOCKED") {
    throw ApiError.forbidden(
      "This account has been blocked. Please contact support.",
    );
  }
  if (agent.status === "PENDING") {
    throw ApiError.forbidden(
      "This account is awaiting approval. You will be notified once it is active.",
    );
  }
}

export type AgentSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  expiresIn: number;
};

/** Issues a fresh access/refresh pair and stores the refresh token's hash. */
export async function issueAgentSession(agent: Agent): Promise<AgentSession> {
  const { token: accessToken, expiresAt } = await signAgentAccessToken({
    agentId: agent.id,
    mobile: agent.mobile,
  });

  const refreshToken = createRefreshToken();
  const refreshExpiry = new Date(
    Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  );

  await prisma.refreshToken.create({
    data: {
      agentId: agent.id,
      tokenHash: await hashRefreshToken(refreshToken),
      expiresAt: refreshExpiry,
    },
  });

  return {
    accessToken,
    refreshToken,
    expiresAt,
    expiresIn: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
  };
}

/** Rotates a refresh token: the old one is revoked and a new pair returned. */
export async function rotateRefreshToken(
  rawToken: string,
): Promise<{ agent: Agent; session: AgentSession }> {
  const tokenHash = await hashRefreshToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { agent: true },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw ApiError.unauthorized("This session has expired. Please log in again.");
  }

  assertAgentCanSignIn(stored.agent);

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  return {
    agent: stored.agent,
    session: await issueAgentSession(stored.agent),
  };
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = await hashRefreshToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllRefreshTokens(agentId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { agentId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Admins (this panel)
// ---------------------------------------------------------------------------

/** The signed-in admin, or null — for layouts and pages that redirect. */
export async function getAdmin(): Promise<Admin | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifyAdminSession(token);
  if (!claims) return null;

  const admin = await prisma.admin.findUnique({ where: { id: claims.adminId } });
  if (!admin || !admin.isActive) return null;
  return admin;
}

/** The signed-in admin, or an ApiError — for API routes and server actions. */
export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) throw ApiError.unauthorized("Please sign in to the admin panel");
  return admin;
}

export async function requireSuperAdmin(): Promise<Admin> {
  const admin = await requireAdmin();
  if (admin.role !== "SUPER_ADMIN") {
    throw ApiError.forbidden("Only a super admin can do this");
  }
  return admin;
}

export async function setAdminCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function clearAdminCookie(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}
