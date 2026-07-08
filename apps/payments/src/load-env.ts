import { join } from "node:path";
import { config } from "dotenv";

/**
 * Loads `apps/payments/.env` before the rest of the app evaluates, so Stripe
 * secrets (and any other overrides) are in `process.env` by the time providers
 * read them. This module is imported first in `main.ts`, so its body runs before
 * the `AppModule` graph loads.
 *
 * The path is resolved from this file — not the cwd — so it works however the
 * process is launched (turbo dev, `node dist/main.js`, docker). A missing `.env`
 * is a harmless no-op, and real environment variables (e.g. docker-compose) win:
 * dotenv never overrides an already-set variable.
 */
config({ path: join(__dirname, "..", ".env") });
