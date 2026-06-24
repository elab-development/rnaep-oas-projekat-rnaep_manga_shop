import type { Role } from "@workspace/contracts";

/**
 * The identity derived from a verified JWT. Ownership checks must always read
 * identity from here (the token), never from the request body or params
 * (ADR-0007, ADR-0012 IDOR protection).
 */
export interface AuthUser {
  userId: string;
  role: Role;
  email?: string;
}

/** Shape of the signed JWT payload issued by the Auth service. */
export interface JwtPayload {
  sub: string;
  role: Role;
  email?: string;
}
