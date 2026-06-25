/**
 * Single source of truth for the shared JWT settings (ADR-0007). Auth signs
 * tokens with these; every service's {@link JwtStrategy} verifies with the same
 * secret. The dev fallback keeps `pnpm dev` working without a `.env`; production
 * must set `JWT_SECRET`.
 */
export const DEV_JWT_SECRET = "dev-insecure-secret-replace-in-prod";

/** Tokens are short-lived (15 min) — no revocation list in v1 (ADR-0007). */
export const TOKEN_TTL = "15m";

/** The verification secret: `JWT_SECRET` if set, else the dev fallback. */
export function getJwtSecret(): string {
  return process.env.JWT_SECRET ?? DEV_JWT_SECRET;
}
