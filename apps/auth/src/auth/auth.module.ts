import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthGuardModule, getJwtSecret, TOKEN_TTL } from "@workspace/auth-guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

/**
 * Account creation and authentication (ADR-0005, ADR-0007). Signs tokens with
 * the shared secret/TTL so every service can verify them locally.
 */
@Module({
  imports: [
    AuthGuardModule,
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: TOKEN_TTL },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
