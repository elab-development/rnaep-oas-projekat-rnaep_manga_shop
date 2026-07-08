import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { JwtPayload } from "@workspace/auth-guard";
import {
  Roles,
  type ResolvedEmail,
  type Role,
} from "@workspace/contracts";
import * as bcrypt from "bcrypt";
import { asc, eq, inArray } from "drizzle-orm";
import { DRIZZLE, type Database } from "../db/drizzle.module";
import { users } from "../db/schema";

const BCRYPT_ROUNDS = 10;

/** The account fields safe to return to a client — never the password hash. */
export interface PublicUser {
  id: string;
  email: string;
  role: Role;
  createdAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Creates a Customer (the default role, ADR-0005) with a bcrypt-hashed
   * password. A duplicate email is a 409, not a 500.
   */
  async register(email: string, password: string): Promise<PublicUser> {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    try {
      const [user] = await this.db
        .insert(users)
        .values({ email, passwordHash, role: Roles.Customer })
        .returning();
      return this.toPublic(user);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException("Email already registered");
      }
      throw err;
    }
  }

  /**
   * Verifies credentials and issues a short-lived JWT (ADR-0007). Unknown email
   * and wrong password are indistinguishable (same 401) to avoid user
   * enumeration.
   */
  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string }> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      email: user.email,
    };
    return { accessToken: await this.jwt.signAsync(payload) };
  }

  /**
   * Lists every account for the Admin user panel (issue 06), oldest first.
   * Admin-only — enforced by the controller's `@Roles('admin')` guard, not here.
   * Never leaks the password hash (returns {@link PublicUser}).
   */
  async listUsers(): Promise<PublicUser[]> {
    const rows = await this.db
      .select()
      .from(users)
      .orderBy(asc(users.createdAt));
    return rows.map((u) => this.toPublic(u));
  }

  /**
   * Sets a user's single role (ADR-0005). The actor must be an Admin — enforced
   * by the controller guard — and the target is addressed by id. A promoted user
   * gets the new role on their next login (tokens are short-lived, ADR-0007;
   * there's no revocation list, so an existing token keeps its old role until it
   * expires). A missing target is a 404, not a silent no-op.
   */
  async changeRole(id: string, role: Role): Promise<PublicUser> {
    const [updated] = await this.db
      .update(users)
      .set({ role })
      .where(eq(users.id, id))
      .returning();
    if (!updated) {
      throw new NotFoundException("User not found");
    }
    return this.toPublic(updated);
  }

  /**
   * Resolves a batch of user ids to `{ id, email }` (issue 10, ADR-0011) so an
   * Admin's order-oversight view can show the customer behind each order without
   * the email ever being duplicated onto the order (ADR-0010). Admin-only —
   * enforced by the controller guard. Unknown ids are simply omitted (not an
   * error), and an empty batch short-circuits without touching the DB. Returns
   * only id + email, never the password hash.
   */
  async resolveEmails(ids: string[]): Promise<ResolvedEmail[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(users.id, ids));
    return rows.map((u) => ({ id: u.id, email: u.email }));
  }

  private toPublic(user: typeof users.$inferSelect): PublicUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}

/**
 * Postgres unique-violation SQLSTATE (23505). Drizzle wraps driver errors, so
 * the original pg error may sit on `cause`; check both levels.
 */
function isUniqueViolation(err: unknown): boolean {
  const code = (e: unknown): string | undefined =>
    typeof e === "object" && e !== null && "code" in e
      ? (e as { code?: string }).code
      : undefined;
  const cause =
    typeof err === "object" && err !== null && "cause" in err
      ? (err as { cause?: unknown }).cause
      : undefined;
  return code(err) === "23505" || code(cause) === "23505";
}
