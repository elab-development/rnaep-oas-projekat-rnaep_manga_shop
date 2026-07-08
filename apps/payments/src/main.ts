// Must be first: loads apps/payments/.env into process.env before the AppModule
// graph (which reads Stripe/DB env) is evaluated.
import "./load-env";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

const SERVICE = "payments";
const DEFAULT_PORT = 3004;

async function bootstrap(): Promise<void> {
  // `rawBody: true` preserves the exact request bytes so the Stripe webhook
  // signature can be verified against them (ADR-0008); JSON parsing still runs
  // for the JWT-guarded checkout-session endpoint.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  // Validate and strip every DTO at the boundary (ADR-0012).
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  await app.listen(port);
  new Logger(SERVICE).log(`${SERVICE} service listening on port ${port}`);
}

void bootstrap();
