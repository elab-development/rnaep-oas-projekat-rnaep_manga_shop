/**
 * New Arrivals recency (CONTEXT.md: New Arrivals). A Manga's `createdAt` drives
 * both the newest-first ordering and the homepage NEW badge: a tile is "new"
 * when it was created within the last 30 days. Evaluated at render time — under
 * the homepage's hourly ISR (ADR-0016) the badge can lag by up to that window,
 * which is acceptable for a landing surface.
 */

const NEW_ARRIVAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** True when `createdAt` (ISO-8601) is within the last 30 days of `now`. */
export function isNewArrival(createdAt: string, now: Date = new Date()): boolean {
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) return false;
  return now.getTime() - created <= NEW_ARRIVAL_WINDOW_MS;
}
