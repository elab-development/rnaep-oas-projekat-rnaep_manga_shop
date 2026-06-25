import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { JwtPayload } from "@workspace/auth-guard";
import { Roles, type Role } from "@workspace/contracts";
import * as bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
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
