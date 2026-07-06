/**
 * Shared Kafka transport for the order-fulfillment saga (issue 11, ADR-0003,
 * ADR-0013). The migration from synchronous REST to event-driven choreography
 * swaps only the transport: services emit/consume the same `@workspace/contracts`
 * payloads they used as REST DTOs, keyed by `orderId`, one consumer group per
 * service, at-least-once with state-based idempotency and log-and-drop failures.
 *
 * - {@link KafkaProducer}: injectable producer; `emit(topic, orderId, payload)`.
 * - {@link KafkaConsumer}: base class a service subclasses to declare its group,
 *   topics, and message handler.
 */
export * from "./config";
export * from "./producer";
export * from "./consumer";
