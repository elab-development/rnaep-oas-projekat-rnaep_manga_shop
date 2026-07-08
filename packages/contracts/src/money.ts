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

/**
 * A price converted into each display currency's major unit (ADR-0006), e.g.
 * `{ USD: 16.2, GBP: 12.75, JPY: 2400 }`. Display-only — computed from cached
 * Frankfurter rates and never affects what is charged.
 */
export type DisplayPrices = Record<DisplayCurrency, number>;
