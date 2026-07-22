import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { json, urlencoded } from "express";
import helmet from "helmet";
import { AppModule } from "./app.module";

// QA/security audit, TC-SEC-07: a missing API_CORS_ORIGIN used to silently
// fall back to the localhost dev origin — safe in dev, but a misconfigured
// production deploy would fail *open* to that dev-shaped default instead of
// failing loudly at boot. Only development gets the fallback now.
function resolveCorsOrigin(): string | string[] {
  const raw = process.env.API_CORS_ORIGIN;
  if (raw) return raw.split(",");
  if (process.env.NODE_ENV === "production") {
    throw new Error("API_CORS_ORIGIN must be set explicitly in production — no dev fallback here.");
  }
  return "http://localhost:3000";
}

async function bootstrap() {
  // Body parser off by default here so it can be re-added below with an
  // explicit size limit (QA/security audit, TC-API-03) instead of Nest's
  // unbounded-by-default Express parser.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: "1mb" }));
  app.use(urlencoded({ extended: true, limit: "1mb" }));

  app.use(helmet());
  app.enableCors({
    origin: resolveCorsOrigin(),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix("api/v1");

  const port = process.env.API_PORT ?? 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}/api/v1`);
}

bootstrap();
