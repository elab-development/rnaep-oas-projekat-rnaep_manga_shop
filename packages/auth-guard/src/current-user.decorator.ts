import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthUser } from "./auth-user";

/**
 * Injects the {@link AuthUser} that {@link JwtStrategy} attached from the
 * verified token. Ownership/IDOR checks must read identity from here, never
 * from the request body or params (ADR-0007, ADR-0012).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
