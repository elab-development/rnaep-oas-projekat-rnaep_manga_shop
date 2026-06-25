import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

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
