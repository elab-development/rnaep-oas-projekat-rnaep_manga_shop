import type { NextFunction, Request, Response } from "express";
import { getJwtSecret } from "@workspace/auth-guard";
import * as jwt from "jsonwebtoken";

/**
 * Gateway fast-fail (ADR-0007, ADR-0011): if a request carries a Bearer token,
 * verify it here with the shared secret and reject early on failure, sparing
 * downstream services the round trip. A request with **no** token passes
 * through — public routes (register/login, catalog browse) need no token, and
 * each service still runs its own guard for protected routes (defense in depth).
 */
export function jwtFastFail(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (!header) {
    next();
    return;
  }

  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ message: "Malformed Authorization header" });
    return;
  }

  try {
    jwt.verify(token, getJwtSecret());
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}
