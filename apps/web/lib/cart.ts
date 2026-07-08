import type { CartView, MangaView } from "@workspace/contracts";
import { authHeader, gatewayUrl } from "./auth";

/**
 * Browser-side cart client. Talks ONLY to the API gateway (ADR-0011), carrying
 * the Customer's JWT in the Authorization header (ADR-0007). The Orders service
 * re-verifies the token and derives the owning customer from it — this layer only
 * shapes requests and surfaces errors for the cart UI. There is no guest cart
 * (ADR-0010): every call here requires a signed-in session.
 */

/** Thrown when a gateway cart call responds non-2xx. */
export class CartError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CartError";
  }
}

async function messageFor(res: Response): Promise<string> {
  if (res.status === 401) return "Please sign in to use your cart.";
  if (res.status === 404) return "That item isn't in your cart.";
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

async function send(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<CartView> {
  const res = await fetch(`${gatewayUrl()}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...authHeader(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new CartError(await messageFor(res), res.status);
  return (await res.json()) as CartView;
}

/** Fetches the signed-in Customer's cart. */
export function getCart(): Promise<CartView> {
  return send("/cart", "GET");
}

/** Adds a manga (or bumps its quantity) and returns the updated cart. */
export function addToCart(mangaId: string, quantity = 1): Promise<CartView> {
  return send("/cart/items", "POST", { mangaId, quantity });
}

/** Sets a line's absolute quantity and returns the updated cart. */
export function setQuantity(
  mangaId: string,
  quantity: number,
): Promise<CartView> {
  return send(`/cart/items/${encodeURIComponent(mangaId)}`, "PATCH", {
    quantity,
  });
}

/** Removes a line and returns the updated cart. */
export function removeItem(mangaId: string): Promise<CartView> {
  return send(`/cart/items/${encodeURIComponent(mangaId)}`, "DELETE");
}

/**
 * Resolves a cart line's Manga details for display. The cart stores only ids
 * (ADR-0010); the shop composes the title/price/cover from Catalog here, on the
 * client, the same way every other authed view does. Returns null if the manga
 * was deleted from the catalog since it was added.
 */
export async function fetchCartManga(id: string): Promise<MangaView | null> {
  const res = await fetch(
    `${gatewayUrl()}/catalog/manga/${encodeURIComponent(id)}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new CartError(await messageFor(res), res.status);
  return (await res.json()) as MangaView;
}
