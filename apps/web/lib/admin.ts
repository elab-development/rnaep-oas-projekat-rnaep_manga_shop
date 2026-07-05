import type { Role, UserView } from "@workspace/contracts";
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
  if (res.status === 404) return "That user no longer exists.";
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
