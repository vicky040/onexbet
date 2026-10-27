/**
 * Environment access. Values are read lazily so that importing this module
 * (including from middleware) never throws at build time.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get authSecret() {
    return required("AUTH_SECRET");
  },
  get accessTokenTtl() {
    return process.env.ACCESS_TOKEN_TTL || "1h";
  },
  get refreshTokenTtlDays() {
    return Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);
  },
  get adminSessionTtl() {
    return process.env.ADMIN_SESSION_TTL || "8h";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  /** True on Vercel and other function hosts, where pools must stay small. */
  get isServerless() {
    return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  },
};

export const ADMIN_COOKIE = "onexbet_admin_session";
