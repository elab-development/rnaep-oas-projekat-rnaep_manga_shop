import { Module } from "@nestjs/common";
import { AuthGuardModule } from "@workspace/auth-guard";
import { AppController } from "./app.controller";
import { DatabaseModule } from "./database.module";
import { MangaModule } from "./manga/manga.module";
import { ReservationModule } from "./reservation/reservation.module";

@Module({
  imports: [DatabaseModule, AuthGuardModule, MangaModule, ReservationModule],
  controllers: [AppController],
})
export class AppModule {}
