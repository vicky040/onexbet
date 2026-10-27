import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "./env";

/**
 * Agents (the Flutter app) authenticate with a bearer access token plus a
 * rotating refresh token. Admins use an httpOnly session cookie. Both are
 * HS256 JWTs signed with AUTH_SECRET and separated by their `aud` claim, so
 * an agent token can never be replayed against the admin panel.
 *
 * Only Web Crypto is used here, so this module is safe to import from
 * middleware (edge runtime) as well as from route handlers.
 */

const ISSUER = "onexbet-admin";
const AGENT_AUDIENCE = "onexbet-agent";
const ADMIN_AUDIENCE = "onexbet-admin-panel";

function secret() {
  return new TextEncoder().encode(env.authSecret);
}

export type AgentClaims = { agentId: string; mobile: string };
export type AdminClaims = { adminId: string; role: string; email: string };

export async function signAgentAccessToken(
  claims: AgentClaims,
): Promise<{ token: string; expiresAt: Date }> {
  const token = await new SignJWT({ mobile: claims.mobile })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.agentId)
    .setIssuer(ISSUER)
    .setAudience(AGENT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(env.accessTokenTtl)
    .sign(secret());
  const { payload } = await jwtVerify(token, secret(), {
    issuer: ISSUER,
    audience: AGENT_AUDIENCE,
  });
  return { token, expiresAt: new Date((payload.exp ?? 0) * 1000) };
}

export async function verifyAgentAccessToken(
  token: string,
): Promise<AgentClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: AGENT_AUDIENCE,
    });
    if (!payload.sub) return null;
    return { agentId: payload.sub, mobile: String(payload.mobile ?? "") };
  } catch {
    return null;
  }
}

export async function signAdminSession(claims: AdminClaims): Promise<string> {
  return new SignJWT({ role: claims.role, email: claims.email })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.adminId)
    .setIssuer(ISSUER)
    .setAudience(ADMIN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(env.adminSessionTtl)
    .sign(secret());
}

export async function verifyAdminSession(
  token: string,
): Promise<AdminClaims | null> {
  try {
    const { payload }: { payload: JWTPayload } = await jwtVerify(
      token,
      secret(),
      { issuer: ISSUER, audience: ADMIN_AUDIENCE },
    );
    if (!payload.sub) return null;
    return {
      adminId: payload.sub,
      role: String(payload.role ?? "OPERATOR"),
      email: String(payload.email ?? ""),
    };
  } catch {
    return null;
  }
}

/** Opaque refresh token; only its SHA-256 is stored. */
export function createRefreshToken(): string {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function hashRefreshToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Bearer token from an `Authorization` header, if present. */
export function bearerFrom(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (!value || scheme.toLowerCase() !== "bearer") return null;
  return value.trim() || null;
}
