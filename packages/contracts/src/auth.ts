import type { Role } from "./roles";

/**
 * Auth read/write models shared between the Auth service and the Next.js
 * frontend (ADR-0003: payload shapes live in `@workspace/contracts`). Fields are
 * English (ADR-0004); a user has exactly one `role` (ADR-0005).
 */

/**
 * A user account as exposed by the Auth service's admin endpoints. Never carries
 * the password hash. `createdAt` is an ISO-8601 string (JSON has no Date).
 */
export interface UserView {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
}

/**
 * The Admin's role-change input: the single target role the user should hold
 * (ADR-0005). Identity of the *actor* comes from the verified token, never the
 * body (ADR-0007); this only names the target role.
 */
export interface ChangeRoleInput {
  role: Role;
}
