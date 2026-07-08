/**
 * Canonical Kafka topic names for the order-fulfillment saga (ADR-0002,
 * ADR-0003, ADR-0013). English, kebab-case. Used as REST route semantics in the
 * synchronous phase and as topic names once the saga migrates to Kafka.
 */
export const Topics = {
  OrderCreated: "order-created",
  StockReserved: "stock-reserved",
  StockRejected: "stock-rejected",
  PaymentSucceeded: "payment-succeeded",
  PaymentFailed: "payment-failed",
} as const;

export type Topic = (typeof Topics)[keyof typeof Topics];
