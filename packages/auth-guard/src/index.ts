/**
 * Shared auth-guard package (ADR-0007, ADR-0005). Every service verifies the
 * JWT itself with these primitives using the shared `JWT_SECRET`. Slice 01 is
 * the scaffold (importable stubs); slice 02 wires real issuance/config.
 */
export * from "./auth-user";
export * from "./auth-guard.module";
export * from "./jwt.strategy";
export * from "./jwt-auth.guard";
export * from "./roles.decorator";
export * from "./roles.guard";
