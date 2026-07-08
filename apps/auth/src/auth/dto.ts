import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";
import {
  RESOLVE_EMAILS_MAX_IDS,
  Roles,
  type ResolveEmailsInput,
  type Role,
} from "@workspace/contracts";

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

/**
 * Batch email-resolution input (issue 10, ADR-0011). An Admin passes the distinct
 * `customerId`s behind a page of orders; Auth returns each known account's email
 * so Next.js can compose the oversight view without the email ever being stored
 * on an order (ADR-0010). `@IsUUID` on every id keeps a malformed batch a 400, and
 * `@ArrayMaxSize` bounds the query (ADR-0012).
 */
export class ResolveEmailsDto implements ResolveEmailsInput {
  @IsArray()
  @ArrayMaxSize(RESOLVE_EMAILS_MAX_IDS)
  @IsUUID(undefined, { each: true })
  ids!: string[];
}
