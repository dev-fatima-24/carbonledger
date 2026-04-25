import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import helmet from "helmet";
import { json } from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.use(json({ limit: "10kb" }));
  app.setGlobalPrefix("api/v1");
  app.enableCors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Health check endpoint — used by Docker and load balancer probes
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get("/health", (_req: any, res: any) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  await app.listen(process.env.PORT || 3001);
  console.log(`CarbonLedger API running on port ${process.env.PORT || 3001}`);
}
bootstrap();
