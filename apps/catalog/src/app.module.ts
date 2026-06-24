import { Module } from "@nestjs/common";
import { AuthGuardModule } from "@workspace/auth-guard";
import { AppController } from "./app.controller";
import { DatabaseModule } from "./database.module";

@Module({
  imports: [DatabaseModule, AuthGuardModule],
  controllers: [AppController],
})
export class AppModule {}
