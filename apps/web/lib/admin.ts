import type {
  AdminOrderView,
  OrderStatusResult,
  ResolvedEmail,
  Role,
  UserView,
} from "@workspace/contracts";
import { authHeader, gatewayUrl } from "./auth";

/**
 * Browser-side admin client. Talks ONLY to the API gateway (ADR-0011), carrying
 * the admin's JWT in the Authorization header (ADR-0007). The Auth service
 * re-verifies the token and enforces `@Roles('admin')` — this layer only shapes
 * requests and surfaces errors for the panel UI. Client-side role gating is UX,
 * never the security decision (ADR-0012).
 */

/** Thrown when a gateway admin call responds non-2xx. */
export class AdminError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AdminError";
  }
}

async function messageFor(res: Response): Promise<string> {
  if (res.status === 401) return "Please sign in again.";
  if (res.status === 403) return "Admins only.";
  if (res.status === 404) return "That record no longer exists.";
  if (res.status === 409)
    return "Only a paid order can be marked shipped.";
  try {
    const data = (await res.json()) as { message?: string | string[] };
    const m = data.message;
    if (Array.isArray(m)) return m.join(" ");
    if (m) return m;
  } catch {
    // fall through
  }
  return "Something went wrong. Please try again.";
}

/** Lists every account for the admin user panel. */
export async function listUsers(): Promise<UserView[]> {
  const res = await fetch(`${gatewayUrl()}/auth/users`, {
    headers: authHeader(),
  });
  if (!res.ok) throw new AdminError(await messageFor(res), res.status);
  return (await res.json()) as UserView[];
}

/** Sets a user's single role (ADR-0005); returns the updated account. */
export async function changeRole(id: string, role: Role): Promise<UserView> {
  const res = await fetch(`${gatewayUrl()}/auth/users/${id}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new AdminError(await messageFor(res), res.status);
  return (await res.json()) as UserView;
}

/**
 * Lists every order for the admin oversight panel (issue 10), newest first. Each
 * row carries the owning `customerId`; the email is resolved separately via
 * {@link resolveEmails} so it is never stored on the order (ADR-0010/0011).
 */
export async function listAllOrders(): Promise<AdminOrderView[]> {
  const res = await fetch(`${gatewayUrl()}/orders/all`, {
    headers: authHeader(),
  });
  if (!res.ok) throw new AdminError(await messageFor(res), res.status);
  return (await res.json()) as AdminOrderView[];
}

/**
 * Batch-resolves the customers behind a set of orders to `{ id, email }`
 * (issue 10, ADR-0011) — the on-demand join that keeps the email out of the
 * order. Cross-service composition lives here in the Next.js layer, which talks
 * only to the gateway (ADR-0011). Unknown ids are simply omitted from the reply.
 */
export async function resolveEmails(ids: string[]): Promise<ResolvedEmail[]> {
  const res = await fetch(`${gatewayUrl()}/auth/users/emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new AdminError(await messageFor(res), res.status);
  return (await res.json()) as ResolvedEmail[];
}

/**
 * Marks a `paid` order `shipped` (issue 10, ADR-0010). Admin-only; the Orders
 * service rejects a non-`paid` order (409) and re-enforces the role. Returns the
 * new status so the panel can update the row in place.
 */
export async function shipOrder(id: string): Promise<OrderStatusResult> {
  const res = await fetch(`${gatewayUrl()}/orders/${id}/ship`, {
    method: "PATCH",
    headers: authHeader(),
  });
  if (!res.ok) throw new AdminError(await messageFor(res), res.status);
  return (await res.json()) as OrderStatusResult;
}
