import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Guard that requires a valid JWT on a route. Backed by {@link JwtStrategy}.
 * Apply with `@UseGuards(JwtAuthGuard)`.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
