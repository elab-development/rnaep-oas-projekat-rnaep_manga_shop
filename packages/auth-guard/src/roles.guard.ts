import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLE_RANK, type Role } from "@workspace/contracts";
import type { AuthUser } from "./auth-user";
import { MIN_ROLE_KEY, ROLES_KEY } from "./roles.decorator";

/**
 * Enforces `@MinRole` (hierarchical) and `@Roles` (exact / allow-list)
 * authorization (ADR-0005). Runs after {@link JwtAuthGuard} has attached the
 * verified user to the request. Slice 02 finalizes the issuance side; the
 * decision logic here is already the real check.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];

    const minRole = this.reflector.getAllAndOverride<Role | undefined>(
      MIN_ROLE_KEY,
      targets,
    );
    const allowList = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      targets,
    );

    if (!minRole && !allowList) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("Authentication required");
    }

    if (minRole && ROLE_RANK[user.role] < ROLE_RANK[minRole]) {
      throw new ForbiddenException("Insufficient role");
    }

    if (allowList && !allowList.includes(user.role)) {
      throw new ForbiddenException("Insufficient role");
    }

    return true;
  }
}
