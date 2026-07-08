import { Module } from "@nestjs/common";
import { AuthGuardModule } from "@workspace/auth-guard";
import { AppController } from "./app.controller";

/**
 * The gateway is thin (ADR-0011): JWT validation, CORS, and path→service
 * routing only. Slice 01 stands it up with a health endpoint; routing lands in
 * later slices. It owns no database.
 */
@Module({
  imports: [AuthGuardModule],
  controllers: [AppController],
})
export class AppModule {}
