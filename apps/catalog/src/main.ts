import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

const SERVICE = "catalog";
const DEFAULT_PORT = 3002;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // Validate, strip, and coerce every DTO at the boundary (ADR-0012). `transform`
  // turns query strings (page/limit) into the numbers the DTO declares.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  await app.listen(port);
  new Logger(SERVICE).log(`${SERVICE} service listening on port ${port}`);
}

void bootstrap();
