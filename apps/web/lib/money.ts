/**
 * Money display helpers. Prices are EUR integer cents everywhere (ADR-0006);
 * EUR is the only settlement currency. USD/GBP/JPY display labels arrive in
 * slice 04 — this slice shows EUR only.
 */

const EUR = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
});

/** Formats EUR integer cents as a localized EUR string, e.g. `1499` → `€14.99`. */
export function formatEur(cents: number): string {
  return EUR.format(cents / 100);
}
