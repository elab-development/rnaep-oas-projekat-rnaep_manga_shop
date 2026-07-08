import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import type { Topic } from "@workspace/contracts";
import { Kafka, type Producer } from "kafkajs";
import { kafkaBrokers, kafkaConfig, kafkaEnabled } from "./config";

/**
 * The saga's Kafka producer (ADR-0003, ADR-0013). Every saga message is emitted
 * **keyed by `orderId`** so all events for one order land on the same partition
 * and stay ordered, while different orders parallelize. This replaces the
 * synchronous-first REST clients (Orders→Catalog reserve, Payments→Catalog/Orders
 * settle) — the payload shapes are unchanged (`@workspace/contracts`).
 *
 * The connection is opened at bootstrap but **non-fatally**: a missing broker
 * never fails boot (mirroring the DB modules), and {@link emit} lazily reconnects
 * on first use so a producer-only service still starts when the broker is late.
 */
@Injectable()
export class KafkaProducer
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(KafkaProducer.name);
  private readonly producer: Producer;
  private connected = false;
  private stopped = false;
  private bootConnect?: Promise<void>;

  constructor() {
    const kafka = new Kafka(kafkaConfig());
    this.producer = kafka.producer({ allowAutoTopicCreation: true });
  }

  onApplicationBootstrap(): void {
    if (!kafkaEnabled()) {
      this.stopped = true;
      return;
    }
    // Fire-and-forget so boot never blocks on the broker; `emit` reconnects
    // lazily anyway, so a producer-only path still works if the broker is late.
    // Tracked so shutdown can await it — nothing must reconnect/log after the app
    // (or a test) is gone.
    this.bootConnect = this.connect().catch((err: Error) => {
      if (!this.stopped) {
        this.logger.warn(
          `Kafka producer not connected at boot: ${err.message}`,
        );
      }
    });
  }

  /**
   * Emits a saga event on `topic`, partitioned by `key` (always the `orderId`).
   * Awaits the broker acknowledgement so a failed publish is surfaced to the
   * caller rather than silently lost — a payment/stock outcome must fail loudly
   * (ADR-0009).
   */
  async emit<T>(topic: Topic, key: string, message: T): Promise<void> {
    await this.connect();
    await this.producer.send({
      topic,
      messages: [{ key, value: JSON.stringify(message) }],
    });
  }

  private async connect(): Promise<void> {
    if (this.connected || this.stopped) {
      return;
    }
    this.logger.log(`Kafka producer connecting to ${kafkaBrokers().join(", ")}`);
    await this.producer.connect();
    this.connected = true;
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    // Let an in-flight boot connect settle before teardown so kafkajs never
    // reconnects/logs after the app is gone.
    await this.bootConnect?.catch(() => undefined);
    if (this.connected) {
      await this.producer.disconnect().catch(() => undefined);
      this.connected = false;
    }
  }
}
