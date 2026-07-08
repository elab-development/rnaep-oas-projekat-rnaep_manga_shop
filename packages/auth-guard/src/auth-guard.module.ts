import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { JwtStrategy } from "./jwt.strategy";
import { RolesGuard } from "./roles.guard";

/**
 * Drop-in module that registers the shared Passport JWT strategy and the roles
 * guard so a service can verify tokens itself (ADR-0007). Import it in a
 * service's root module; protect routes with `JwtAuthGuard` + `RolesGuard` in
 * the slices that add guarded endpoints.
 */
@Module({
  imports: [PassportModule],
  providers: [JwtStrategy, RolesGuard],
  exports: [PassportModule, RolesGuard],
})
export class AuthGuardModule {}
