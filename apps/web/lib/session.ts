import type { Role } from "@workspace/contracts";
import { getToken } from "./auth";

/**
 * Client-side view of the signed-in identity, decoded from the JWT the browser
 * holds (ADR-0007: identity lives in the token). This read is for UI gating only
 * — showing the moderator panel, hiding actions — never for authorization. Every
 * service re-verifies the token, so a tampered payload buys nothing (ADR-0012).
 */
export interface Session {
  userId: string;
  role: Role;
  email?: string;
  /** Expiry as a Unix timestamp (seconds), if present. */
  exp?: number;
}

/** Decodes the current token's payload, or null if absent/malformed/expired. */
export function currentSession(): Session | null {
  const token = getToken();
  if (!token) return null;
  const payload = decodePayload(token);
  if (!payload) return null;
  if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
    return null;
  }
  if (typeof payload.sub !== "string" || typeof payload.role !== "string") {
    return null;
  }
  return {
    userId: payload.sub,
    role: payload.role as Role,
    email: typeof payload.email === "string" ? payload.email : undefined,
    exp: typeof payload.exp === "number" ? payload.exp : undefined,
  };
}

/** True when the session's role is at least `moderator` (moderator or admin). */
export function isModerator(session: Session | null): boolean {
  return session?.role === "moderator" || session?.role === "admin";
}

/** True when the session's role is `admin`. */
export function isAdmin(session: Session | null): boolean {
  return session?.role === "admin";
}

/** Base64url-decodes the JWT payload segment; returns null on any parse error. */
function decodePayload(token: string): Record<string, unknown> | null {
  const segment = token.split(".")[1];
  if (!segment) return null;
  try {
    const json = atob(segment.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}
