import { IsEmail, IsIn, IsString, MaxLength, MinLength } from "class-validator";
import { Roles, type Role } from "@workspace/contracts";

/**
 * Registration input. `class-validator` runs on every DTO (ADR-0012) so
 * malformed input is rejected before it reaches the service.
 */
export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

/** Login input — same credentials, no strength constraints on the attempt. */
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

/**
 * Admin role-change input (ADR-0005). `@IsIn` rejects anything outside the three
 * roles before it reaches the service, so an invalid role is a 400. The target
 * user is addressed by the path param; the actor is the verified token, never
 * the body (ADR-0007).
 */
export class ChangeRoleDto {
  @IsIn([Roles.Customer, Roles.Moderator, Roles.Admin])
  role!: Role;
}
