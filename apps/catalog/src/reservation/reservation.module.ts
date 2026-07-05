import { Module } from "@nestjs/common";
import { MangaModule } from "../manga/manga.module";
import { ReservationController } from "./reservation.controller";
import { reservationModelProvider } from "./reservation.schema";
import { ReservationService } from "./reservation.service";

/**
 * The stock-reservation feature (issue 08, ADR-0002). Imports {@link MangaModule}
 * to share its single Manga model binding (the guarded `$inc reserved` runs
 * against it) and adds its own per-order Reservation model + the internal reserve
 * boundary.
 */
@Module({
  imports: [MangaModule],
  controllers: [ReservationController],
  providers: [reservationModelProvider, ReservationService],
  exports: [ReservationService],
})
export class ReservationModule {}
