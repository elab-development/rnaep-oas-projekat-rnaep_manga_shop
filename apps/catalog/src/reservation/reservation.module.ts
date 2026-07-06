import { Module } from "@nestjs/common";
import { KafkaProducer } from "@workspace/messaging";
import { MangaModule } from "../manga/manga.module";
import { ReservationConsumer } from "./reservation.consumer";
import { reservationModelProvider } from "./reservation.schema";
import { ReservationService } from "./reservation.service";

/**
 * The stock-reservation feature (issue 08, migrated to Kafka in issue 11,
 * ADR-0002/0003). Imports {@link MangaModule} to share its single Manga model
 * binding (the guarded `$inc reserved` runs against it) and adds its own per-order
 * Reservation model. In the Kafka phase the transport is the
 * {@link ReservationConsumer} (`order-created`/`payment-succeeded`/`payment-failed`)
 * plus the {@link KafkaProducer} it emits `stock-reserved`/`stock-rejected` on —
 * the internal REST controller of the sync phase is gone, the domain logic
 * unchanged.
 */
@Module({
  imports: [MangaModule],
  providers: [
    reservationModelProvider,
    ReservationService,
    ReservationConsumer,
    KafkaProducer,
  ],
  exports: [ReservationService],
})
export class ReservationModule {}
