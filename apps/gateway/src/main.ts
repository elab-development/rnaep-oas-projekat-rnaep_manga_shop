import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

const SERVICE = "gateway";
const DEFAULT_PORT = 3000;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  await app.listen(port);
  new Logger(SERVICE).log(`${SERVICE} service listening on port ${port}`);
}

void bootstrap();
