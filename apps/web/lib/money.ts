/**
 * Money display helpers. Prices are EUR integer cents everywhere (ADR-0006);
 * EUR is the only settlement currency. USD/GBP/JPY are display-only labels
 * converted server-side from cached Frankfurter rates — informational, never
 * charged.
 */

import type { DisplayCurrency } from "@workspace/contracts";

const EUR = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
});

/** Formats EUR integer cents as a localized EUR string, e.g. `1499` → `€14.99`. */
export function formatEur(cents: number): string {
  return EUR.format(cents / 100);
}

// One formatter per display currency; `Intl` handles per-currency decimals
// (USD/GBP show cents, JPY none), so a single locale is fine.
const displayFormatters = new Map<DisplayCurrency, Intl.NumberFormat>();

/**
 * Formats a converted display amount (already in the currency's major unit) as
 * a localized string, e.g. `16.2` + `USD` → `$16.20`, `2400` + `JPY` → `¥2,400`.
 */
export function formatDisplayPrice(
  amount: number,
  currency: DisplayCurrency,
): string {
  let formatter = displayFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", { style: "currency", currency });
    displayFormatters.set(currency, formatter);
  }
  return formatter.format(amount);
}
