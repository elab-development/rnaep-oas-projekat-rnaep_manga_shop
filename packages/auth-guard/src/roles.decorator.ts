import { SetMetadata } from "@nestjs/common";
import type { Role } from "@workspace/contracts";

export const MIN_ROLE_KEY = "minRole";
export const ROLES_KEY = "roles";

/**
 * Hierarchical minimum: the caller's role must be `>=` the given role, so an
 * admin passes a `@MinRole('moderator')` check (ADR-0005).
 */
export const MinRole = (role: Role) => SetMetadata(MIN_ROLE_KEY, role);

/**
 * Exact / allow-list: the caller's role must be one of the listed roles, with
 * no hierarchy inheritance (ADR-0005).
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
