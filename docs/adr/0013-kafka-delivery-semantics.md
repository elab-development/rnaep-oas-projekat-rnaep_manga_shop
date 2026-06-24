# Kafka delivery semantics: idempotent, order-keyed consumers; log-and-drop on failure

The saga runs on Kafka's default **at-least-once** delivery, which means duplicates and cross-partition reordering are possible. We handle that with:

- **State-based idempotency.** Consumers derive "already handled?" from domain state — e.g. ignore `payment-succeeded` if the order is already `paid`; don't re-reserve if a reservation for the order already exists. A processed-event-id dedup table is used only where state alone isn't sufficient. So duplicate deliveries are harmless.
- **Per-order ordering via partition key.** Every saga message is keyed by `order_id`, so all events for one order land on the same partition and stay ordered (`order-created` before `payment-succeeded`), while different orders parallelize across partitions and the service's instances.
- **One consumer group per service**, so each service processes each message once and its ~3 instances share partitions.

**Failure handling: log and drop** (no dead-letter topic). A message whose processing throws is logged and discarded so it never blocks the partition.

**Known limitation we accept (student-scale):** a dropped event loses that saga step — e.g. a `payment-succeeded` that fails processing can leave an order stuck out of sync (paid in Stripe but not advanced). This is acceptable for the project's scope; a production system would use retry + a dead-letter topic (ADR-0009's reasoning about not silently dropping payment outcomes applies more strictly there).
