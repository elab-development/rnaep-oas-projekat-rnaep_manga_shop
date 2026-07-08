# Build the inter-service flow synchronously first, then swap to Kafka

The Order → Payment → Stock flow is implemented with **synchronous REST first** (Orders→Catalog HTTP to reserve; Stripe webhook→Payments→Orders HTTP for status), and **migrated to Apache Kafka** in the event-driven (Seminarski) phase. The migration replaces only the transport, not the domain logic.

To keep that swap local rather than a rewrite, the synchronous version is built **Kafka-aware** from day one:
- Catalog's stock changes are explicit `reserve` / `commit` / `release` operations (not an inline decrement), each of which maps 1:1 to a future event handler.
- The **order id is used as an idempotency key** everywhere from the start.
- Event/message payload shapes live in a shared `packages/contracts`, so today's REST DTOs are tomorrow's Kafka message schemas (`order-created`, `stock-reserved`, `stock-rejected`, `payment-succeeded`, `payment-failed`).

**Why not Kafka from the start:** the final deliverable (Seminarski) is graded partly on the *transformation* from synchronous to asynchronous and the justification for it — having genuinely built the sync version first makes that narrative real. It also gives a debuggable, demonstrable baseline (request/response stack traces) while still learning NestJS, Docker, and microservices, before taking on broker/consumer-group/eventual-consistency complexity. Designing the seams up front shrinks the eventual rework to a thin transport layer.

See ADR-0002 for the saga/reservation model this flow implements.
