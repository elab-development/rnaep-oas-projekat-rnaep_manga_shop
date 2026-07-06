import {
  KafkaContainer,
  type StartedKafkaContainer,
} from "@testcontainers/kafka";
import { Topics } from "@workspace/contracts";
import { Kafka, logLevel, type Consumer, type Producer } from "kafkajs";

/**
 * Kafka test harness for the saga integration tests (issue 11). Spins a throwaway
 * broker (testcontainers) and gives a test the two things it needs to drive a
 * service through its **Kafka** boundary: a producer to inject the events the
 * service consumes (standing in for the other services), and an observer to
 * capture the events the service emits. The service under test runs in-process
 * against this same broker via `process.env.KAFKA_BROKERS`.
 */

const KAFKA_IMAGE = "confluentinc/cp-kafka:7.6.0";
/** The container's external PLAINTEXT listener (mapped to a random host port). */
const EXTERNAL_PORT = 9093;

/** All saga topics, pre-created so an observer can subscribe before first emit. */
const ALL_TOPICS = Object.values(Topics);

/** Starts a broker and points `KAFKA_BROKERS` at it (read at service boot). */
export async function startKafka(): Promise<{
  container: StartedKafkaContainer;
  brokers: string[];
}> {
  const container = await new KafkaContainer(KAFKA_IMAGE).start();
  const brokers = [
    `${container.getHost()}:${container.getMappedPort(EXTERNAL_PORT)}`,
  ];
  process.env.KAFKA_BROKERS = brokers.join(",");
  return { container, brokers };
}

/** A test-side Kafka client: emit events in, observe events out. */
export class TestKafka {
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private readonly consumers: Consumer[] = [];

  constructor(brokers: string[]) {
    this.kafka = new Kafka({
      clientId: "saga-test",
      brokers,
      logLevel: logLevel.NOTHING,
    });
    this.producer = this.kafka.producer({ allowAutoTopicCreation: true });
  }

  /** Connects the producer and ensures every saga topic exists. */
  async connect(): Promise<void> {
    const admin = this.kafka.admin();
    await admin.connect();
    await admin.createTopics({
      topics: ALL_TOPICS.map((topic) => ({ topic, numPartitions: 1 })),
      waitForLeaders: true,
    });
    await admin.disconnect();
    await this.producer.connect();
  }

  /** Injects an event on `topic`, keyed by `orderId` (like the real producers). */
  async emit<T>(topic: string, key: string, value: T): Promise<void> {
    await this.producer.send({
      topic,
      messages: [{ key, value: JSON.stringify(value) }],
    });
  }

  /**
   * Starts capturing messages on `topic` into the returned array. Resolves once
   * the observer has joined its group and is positioned at the log end, so any
   * event the test triggers afterwards is captured. Use a fresh observer per
   * assertion so its own consumer group starts clean.
   */
  async observe<T>(topic: string): Promise<T[]> {
    const captured: T[] = [];
    const consumer = this.kafka.consumer({
      groupId: `saga-test-observe-${topic}-${this.consumers.length}`,
    });
    this.consumers.push(consumer);
    const joined = new Promise<void>((resolve) => {
      consumer.on(consumer.events.GROUP_JOIN, () => resolve());
    });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });
    await consumer.run({
      eachMessage: async ({ message }) => {
        const raw = message.value?.toString();
        if (raw) {
          captured.push(JSON.parse(raw) as T);
        }
      },
    });
    await joined;
    return captured;
  }

  async stop(): Promise<void> {
    await this.producer.disconnect().catch(() => undefined);
    for (const consumer of this.consumers) {
      await consumer.disconnect().catch(() => undefined);
    }
  }
}

type Falsy = undefined | null | false | "";

/**
 * Polls `fn` (sync or async) until it returns a truthy value or the timeout
 * elapses, then returns that value. Awaiting `fn()` is what makes an async
 * predicate work — a bare Promise is always truthy, so it must be resolved first.
 */
export async function waitFor<T>(
  fn: () => Promise<T | Falsy> | T | Falsy,
  { timeoutMs = 20_000, intervalMs = 150 } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value) {
      return value;
    }
    if (Date.now() > deadline) {
      throw new Error("waitFor: condition not met before timeout");
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
