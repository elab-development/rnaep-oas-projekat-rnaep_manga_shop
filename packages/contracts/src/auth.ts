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

/**
 * Batch email-resolution request (issue 10, ADR-0011). An Admin overseeing
 * orders resolves the customer behind each order on demand — the email lives only
 * in Auth and is never duplicated onto the order (ADR-0010). The Next.js layer
 * collects the distinct `customerId`s from a page of orders and asks Auth to
 * resolve them all in one call rather than one request per order.
 */
export interface ResolveEmailsInput {
  /** The user ids to resolve; unknown ids are simply omitted from the reply. */
  ids: string[];
}

/** A single resolved account: its id paired with its email (no other fields). */
export interface ResolvedEmail {
  id: string;
  email: string;
}

/** Upper bound on a single batch email-resolution request, to bound the query. */
export const RESOLVE_EMAILS_MAX_IDS = 200;
