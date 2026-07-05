import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentUser,
  JwtAuthGuard,
  Roles as RolesDecorator,
  RolesGuard,
  type AuthUser,
} from "@workspace/auth-guard";
import { Roles } from "@workspace/contracts";
import { AuthService, type PublicUser } from "./auth.service";
import { ChangeRoleDto, LoginDto, RegisterDto } from "./dto";

/**
 * Auth HTTP boundary. Mounted at `/auth` so the thin gateway can route
 * `/auth/*` straight through without rewriting paths (ADR-0011).
 */
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body() dto: RegisterDto): Promise<PublicUser> {
    return this.auth.register(dto.email, dto.password);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<{ accessToken: string }> {
    return this.auth.login(dto.email, dto.password);
  }

  /**
   * Echoes the identity derived from the verified token — proves the shared
   * guard verifies the JWT independently in any service (ADR-0007).
   */
  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }

  /**
   * Admin user panel backing (issue 06). Lists every account so an Admin can see
   * who to promote. Gated with the **exact / allow-list** `@Roles('admin')`
   * (ADR-0005) — deliberately not `@MinRole`, since user administration is an
   * Admin-only ability, not "moderator and up".
   */
  @Get("users")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RolesDecorator(Roles.Admin)
  listUsers(): Promise<PublicUser[]> {
    return this.auth.listUsers();
  }

  /**
   * Changes a target user's single role (ADR-0005). Admin-only via the exact
   * `@Roles('admin')` check. The target is the path id; the actor is the verified
   * token (ADR-0007), never the body.
   */
  @Patch("users/:id/role")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RolesDecorator(Roles.Admin)
  changeRole(
    @Param("id") id: string,
    @Body() dto: ChangeRoleDto,
  ): Promise<PublicUser> {
    return this.auth.changeRole(id, dto.role);
  }
}
