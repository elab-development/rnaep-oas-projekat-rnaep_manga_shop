import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "@workspace/auth-guard";
import { MIN_ROLE_KEY, ROLES_KEY } from "@workspace/auth-guard";
import type { AuthUser } from "@workspace/auth-guard";
import { Roles, type Role } from "@workspace/contracts";

/**
 * Guard-level coverage of the two authorization styles the role model offers
 * (ADR-0005): `@Roles(...)` is an exact allow-list (no inheritance) while
 * `@MinRole(...)` is a hierarchical minimum (higher roles pass). The admin
 * role-change endpoint (issue 06) relies on the exact-check semantics, and this
 * pins the distinction that HTTP tests against a top role can't show — an admin
 * must FAIL an exact `@Roles('moderator')` check but PASS `@MinRole('moderator')`.
 */
describe("RolesGuard: @Roles exact-check vs @MinRole hierarchy", () => {
  const guard = new RolesGuard(new Reflector());

  /** Builds a context whose metadata and current user are fixed for the test. */
  function contextFor(
    metadata: { minRole?: Role; roles?: Role[] },
    role: Role,
  ): ExecutionContext {
    const user: AuthUser = { userId: "u1", role, email: "u@example.com" };
    const handler = () => undefined;
    const cls = class {};
    // Emulate the real decorators writing metadata onto the handler.
    if (metadata.minRole) Reflect.defineMetadata(MIN_ROLE_KEY, metadata.minRole, handler);
    if (metadata.roles) Reflect.defineMetadata(ROLES_KEY, metadata.roles, handler);
    return {
      getHandler: () => handler,
      getClass: () => cls,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
  }

  const canPass = (metadata: { minRole?: Role; roles?: Role[] }, role: Role) => {
    try {
      return guard.canActivate(contextFor(metadata, role));
    } catch (err) {
      if (err instanceof ForbiddenException) return false;
      throw err;
    }
  };

  it("@Roles('moderator') admits only a moderator — an admin is excluded", () => {
    expect(canPass({ roles: [Roles.Moderator] }, Roles.Moderator)).toBe(true);
    expect(canPass({ roles: [Roles.Moderator] }, Roles.Admin)).toBe(false);
    expect(canPass({ roles: [Roles.Moderator] }, Roles.Customer)).toBe(false);
  });

  it("@MinRole('moderator') admits a moderator AND an admin (hierarchy)", () => {
    expect(canPass({ minRole: Roles.Moderator }, Roles.Moderator)).toBe(true);
    expect(canPass({ minRole: Roles.Moderator }, Roles.Admin)).toBe(true);
    expect(canPass({ minRole: Roles.Moderator }, Roles.Customer)).toBe(false);
  });

  it("@Roles('admin') gates the role-change endpoint: only an admin passes", () => {
    expect(canPass({ roles: [Roles.Admin] }, Roles.Admin)).toBe(true);
    expect(canPass({ roles: [Roles.Admin] }, Roles.Moderator)).toBe(false);
    expect(canPass({ roles: [Roles.Admin] }, Roles.Customer)).toBe(false);
  });
});
