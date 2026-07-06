/**
 * Browser-side auth client for the Manga Web Shop frontend.
 *
 * The frontend talks ONLY to the API gateway (ADR-0011); it never calls a
 * service directly. The JWT lives in `localStorage` and travels in the
 * `Authorization: Bearer` header — never a cookie (ADR-0007, ADR-0012). That
 * choice mitigates CSRF by design at the cost of making XSS the load-bearing
 * risk, so React's auto-escaping is doing real security work here.
 */

const TOKEN_KEY = "manga-shop.token";

/**
 * Base URL of the API gateway.
 *
 * The browser must reach the gateway at its publicly published address
 * (`NEXT_PUBLIC_GATEWAY_URL`, inlined at build time). Server components and
 * server actions run *inside* the web container, where that public address
 * (localhost) points at the container itself, not the gateway — so on the
 * server we prefer `GATEWAY_INTERNAL_URL` (e.g. `http://gateway:3000` on the
 * compose network), read at runtime. Both fall back to localhost so host
 * `pnpm dev`, where everything shares localhost, keeps working unchanged.
 */
export function gatewayUrl(): string {
  if (typeof window === "undefined") {
    return (
      process.env.GATEWAY_INTERNAL_URL ??
      process.env.NEXT_PUBLIC_GATEWAY_URL ??
      "http://localhost:3000"
    );
  }
  return process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:3000";
}

export interface PublicUser {
  id: string;
  email: string;
  role: "customer" | "moderator" | "admin";
  createdAt: string;
}

/** Thrown when the gateway responds with a non-2xx status. */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${gatewayUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new AuthError(await messageFor(res), res.status);
  }
  return (await res.json()) as T;
}

async function messageFor(res: Response): Promise<string> {
  if (res.status === 409) return "That email is already registered.";
  if (res.status === 401) return "Wrong email or password.";
  if (res.status === 400) return "Please check your email and password.";
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

/** Register a new Customer (the default role). */
export function register(
  email: string,
  password: string,
): Promise<PublicUser> {
  return post<PublicUser>("/auth/register", { email, password });
}

/** Exchange credentials for a short-lived JWT and persist it. */
export async function login(email: string, password: string): Promise<string> {
  const { accessToken } = await post<{ accessToken: string }>("/auth/login", {
    email,
    password,
  });
  setToken(accessToken);
  return accessToken;
}

export function setToken(token: string): void {
  if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
}

/** Authorization header for authenticated gateway calls, if a token exists. */
export function authHeader(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
