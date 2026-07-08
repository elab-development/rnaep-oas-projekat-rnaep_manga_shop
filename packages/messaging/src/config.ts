import { logLevel } from "kafkajs";

/**
 * Kafka connection config, read from the environment the same way each service
 * reads its other config (ADR-0003, ADR-0013). There is no central config
 * module — a small helper mirrors the `catalogUrl()`/`ordersUrl()` pattern.
 */

/**
 * The broker list. Defaults to the docker-compose Kafka's **host** listener
 * (`127.0.0.1:29092`, published for `pnpm dev`) so host apps work without a
 * `.env` file; docker-compose injects `kafka:9092` (the in-cluster listener) for
 * the containerized `full`-profile services. The two ports are the same single
 * broker reached over its two advertised listeners — see docker-compose.yml.
 * Uses 127.0.0.1, not `localhost`: on Windows `localhost` resolves to IPv6
 * `::1` first, which Docker Desktop's loopback doesn't forward to the container.
 */
export function kafkaBrokers(): string[] {
  return (process.env.KAFKA_BROKERS ?? "127.0.0.1:29092")
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);
}

/**
 * A stable client id for this process. Not the consumer group (that is one per
 * service — ADR-0013 — set where the consumer is declared); this only labels the
 * connection in broker logs/metrics.
 */
export function kafkaClientId(): string {
  return process.env.KAFKA_CLIENT_ID ?? "manga-shop";
}

/**
 * Whether this process should connect to Kafka at all. Always yes in dev/prod. In
 * tests it connects only when a broker is **explicitly** configured (the saga
 * integration tests set `KAFKA_BROKERS` to their ephemeral testcontainers broker);
 * the many unit/HTTP tests that boot the app but don't exercise the saga skip Kafka
 * entirely, so they neither wait on a broker nor race a connection on teardown.
 */
export function kafkaEnabled(): boolean {
  return !(process.env.NODE_ENV === "test" && !process.env.KAFKA_BROKERS);
}

/**
 * The shared Kafka client config. The bounded retry keeps a **missing** broker
 * from stalling boot for long (the connection is non-fatal — a service without a
 * broker just runs with an inert saga), while still riding out the brief coordinator
 * unavailability right after a broker comes up. In the full stack the services
 * `depends_on: kafka (healthy)`, so the broker is already up when they connect.
 */
export function kafkaConfig(): {
  clientId: string;
  brokers: string[];
  connectionTimeout: number;
  retry: { retries: number; initialRetryTime: number };
  logLevel: logLevel;
} {
  return {
    clientId: kafkaClientId(),
    brokers: kafkaBrokers(),
    connectionTimeout: 3000,
    retry: { retries: 5, initialRetryTime: 100 },
    // Silence kafkajs's own console logger — the connect/retry chatter is noise;
    // this package logs the events that matter (join, crash, dropped message)
    // through Nest's logger instead.
    logLevel: logLevel.NOTHING,
  };
}
