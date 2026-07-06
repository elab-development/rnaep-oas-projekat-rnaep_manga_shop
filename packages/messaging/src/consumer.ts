import {
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import type { Topic } from "@workspace/contracts";
import { Kafka, type Consumer } from "kafkajs";
import { kafkaConfig, kafkaEnabled } from "./config";

/** Backoff between consumer (re)connection attempts while the broker is down. */
const RETRY_DELAY_MS = 1000;

/**
 * Base class for a service's saga consumer (ADR-0003, ADR-0013). A service
 * subclasses this, declares its **own consumer group** ({@link groupId} — one
 * group per service so its ~3 instances share partitions and each message is
 * processed once) and the {@link topics} it reacts to, and implements
 * {@link handle}. This replaces the synchronous-first REST controllers
 * (Catalog's `/internal/reservations*`, Orders' `/internal/orders/*`) with the
 * equivalent event handlers — the domain logic they call is unchanged.
 *
 * Delivery is **at-least-once**, so a message can be redelivered. Handlers must
 * be **state-based idempotent** (the underlying reserve/commit/release/transition
 * operations already are). Processing failures are **logged and dropped** (no
 * dead-letter topic — ADR-0013): the offset still commits so a poisoned message
 * never blocks its partition.
 *
 * Connecting is resilient: the first attempt runs at bootstrap and, if the broker
 * isn't ready yet (or is absent), a background loop keeps retrying so the consumer
 * self-heals once the broker comes up — mirroring the producer's lazy reconnect.
 */
export abstract class KafkaConsumer
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly log = new Logger(this.constructor.name);
  private readonly kafka: Kafka;
  private consumer?: Consumer;
  private stopped = false;
  private running = false;
  private retryLoop?: Promise<void>;
  private resolveReady!: () => void;
  private readonly ready = new Promise<void>((resolve) => {
    this.resolveReady = resolve;
  });

  /** This service's consumer group — one per service (ADR-0013). */
  protected abstract readonly groupId: string;
  /** The saga topics this service reacts to. */
  protected abstract readonly topics: Topic[];
  /** Handle one decoded message. Throwing is logged and dropped (ADR-0013). */
  protected abstract handle(topic: string, message: unknown): Promise<void>;

  constructor() {
    this.kafka = new Kafka(kafkaConfig());
  }

  onApplicationBootstrap(): void {
    if (!kafkaEnabled()) {
      this.resolveReady();
      return;
    }
    // Connect in the background so boot never blocks on the broker (a service
    // without one just runs with an inert saga). The loop self-heals: it keeps
    // retrying until the broker is up, then joins. Tracked so shutdown can await
    // it — nothing must log after the app (or a test) is gone.
    this.retryLoop = this.runUntilStarted();
  }

  /** Resolves once the consumer has joined its group and is consuming. */
  whenReady(): Promise<void> {
    return this.ready;
  }

  private async runUntilStarted(): Promise<void> {
    let first = true;
    while (!this.stopped && !this.running) {
      if (!first) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        if (this.stopped) {
          return;
        }
      }
      first = false;
      try {
        await this.start();
        this.resolveReady();
        return;
      } catch (err) {
        if (!this.stopped) {
          this.log.warn(
            `Kafka consumer '${this.groupId}' not connected, will retry: ${(err as Error).message}`,
          );
        }
      }
    }
  }

  /** One connection attempt; resolves after the group is joined, else throws. */
  private async start(): Promise<void> {
    // Pre-create the topics so a fresh cluster doesn't make the consumer wait for
    // a metadata refresh to discover them (matters most in tests).
    const admin = this.kafka.admin();
    await admin.connect();
    try {
      await admin.createTopics({
        topics: this.topics.map((topic) => ({ topic, numPartitions: 1 })),
        waitForLeaders: true,
      });
    } finally {
      await admin.disconnect().catch(() => undefined);
    }

    const consumer = this.kafka.consumer({ groupId: this.groupId });
    // Resolve once the group is joined and partitions are assigned, so a caller
    // (a test) that awaits app bootstrap can then produce and be sure it lands.
    const joined = new Promise<void>((resolve) => {
      consumer.on(consumer.events.GROUP_JOIN, () => resolve());
    });
    consumer.on(consumer.events.CRASH, (e) =>
      this.log.warn(
        `Consumer '${this.groupId}' crashed: ${String(e.payload?.error)}`,
      ),
    );

    try {
      await consumer.connect();
      await consumer.subscribe({ topics: this.topics, fromBeginning: false });
      await consumer.run({
        eachMessage: async ({ topic, message }) => {
          const raw = message.value?.toString();
          if (!raw) {
            return;
          }
          let payload: unknown;
          try {
            payload = JSON.parse(raw);
          } catch (err) {
            this.log.warn(
              `Unparseable ${topic} message dropped: ${String(err)}`,
            );
            return;
          }
          try {
            await this.handle(topic, payload);
          } catch (err) {
            // Log and drop (ADR-0013): commit the offset anyway so a failed
            // message never blocks its partition — the accepted student-scale
            // limitation.
            this.log.error(
              `Dropped ${topic} message: ${(err as Error).message}`,
            );
          }
        },
      });
      await joined;
    } catch (err) {
      await consumer.disconnect().catch(() => undefined);
      throw err;
    }

    this.consumer = consumer;
    this.running = true;
    this.log.log(
      `Consumer group '${this.groupId}' joined; subscribed to ${this.topics.join(", ")}`,
    );
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    // Let any in-flight (re)connection attempt settle before teardown, so nothing
    // logs after the app — or a test — is gone.
    await this.retryLoop?.catch(() => undefined);
    await this.consumer?.disconnect().catch(() => undefined);
  }
}
