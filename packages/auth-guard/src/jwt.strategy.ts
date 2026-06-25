import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy, type StrategyOptions } from "passport-jwt";
import type { AuthUser, JwtPayload } from "./auth-user";
import { getJwtSecret } from "./jwt-config";

/**
 * Passport JWT strategy shared by every service (ADR-0007): each service
 * verifies the token itself with the shared `JWT_SECRET`, reading it from the
 * `Authorization: Bearer` header (never a cookie).
 *
 * Slice 01 scaffold: structurally complete and importable. Slice 02 wires the
 * real secret/expiry configuration and issuance.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const options: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    };
    super(options);
  }

  validate(payload: JwtPayload): AuthUser {
    return { userId: payload.sub, role: payload.role, email: payload.email };
  }
}
