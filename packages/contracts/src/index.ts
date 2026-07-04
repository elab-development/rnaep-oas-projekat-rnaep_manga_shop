/**
 * Shared event/DTO contracts for the Manga Web Shop.
 *
 * These shapes are the single source of truth for both the synchronous REST
 * phase and the later Kafka phase: today's REST DTOs are tomorrow's Kafka
 * message schemas (ADR-0003). The `order_id` is the idempotency key everywhere
 * (ADR-0002). Money is always EUR integer cents (ADR-0006). Ubiquitous language
 * is English (ADR-0004).
 *
 * Slice 01 is the scaffold: the package must exist and be importable. The event
 * payloads here are intentionally minimal placeholders; later slices flesh them
 * out alongside the features that produce/consume them.
 */

export * from "./topics";
export * from "./roles";
export * from "./money";
export * from "./catalog";
export * from "./events";
