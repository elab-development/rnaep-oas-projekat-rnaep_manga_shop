/**
 * Money is EUR stored as integer cents everywhere (ADR-0006). EUR is the only
 * settlement currency; USD/GBP/JPY are display-only conversions that never
 * affect the charge.
 */
export type Cents = number;

/** The settlement currency. */
export const SETTLEMENT_CURRENCY = "EUR" as const;

/** Currencies offered as display-only labels alongside EUR. */
export const DISPLAY_CURRENCIES = ["USD", "GBP", "JPY"] as const;

export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];
