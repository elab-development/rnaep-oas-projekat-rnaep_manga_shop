import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

const SERVICE = "orders";
const DEFAULT_PORT = 3003;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
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
