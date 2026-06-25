import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentUser,
  JwtAuthGuard,
  type AuthUser,
} from "@workspace/auth-guard";
import { AuthService, type PublicUser } from "./auth.service";
import { LoginDto, RegisterDto } from "./dto";

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
}
