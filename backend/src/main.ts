import { NestFactory } from '@nestjs/core';
import { ConsoleLogger, ForbiddenException, LogLevel, ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';

/**
 * Minimal JSON logger — wraps NestJS ConsoleLogger so every line emitted to
 * stdout is a single JSON object.  Promtail's JSON pipeline stage picks up
 * `level`, `message`, and `service` labels automatically.
 */
class JsonLogger extends ConsoleLogger {
  private write(level: string, message: unknown, context?: string): void {
    process.stdout.write(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        service: 'backend',
        context: context ?? this.context,
        message,
      }) + '\n',
    );
  }

  log(message: unknown, context?: string)   { this.write('info',  message, context); }
  error(message: unknown, context?: string) { this.write('error', message, context); }
  warn(message: unknown, context?: string)  { this.write('warn',  message, context); }
  debug(message: unknown, context?: string) { this.write('debug', message, context); }
  verbose(message: unknown, context?: string) { this.write('verbose', message, context); }
}

async function bootstrap() {
  const logLevel = (process.env.LOG_LEVEL ?? 'info').toLowerCase() as LogLevel;

  const app = await NestFactory.create(AppModule, {
    logger: new JsonLogger(undefined, { logLevels: [logLevel] }),
  });

  app.setGlobalPrefix('api/v1');

  // Header-based versioning: Accept-Version: 1
  // All existing routes are VERSION_NEUTRAL (no @Version decorator needed).
  app.enableVersioning({
    type: VersioningType.HEADER,
    header: 'Accept-Version',
  });

  // Fix mass assignment (API3): strip unknown fields globally
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  // Fix API6: limit request body to 1 MB to prevent resource exhaustion
  app.use(require('express').json({ limit: '1mb' }));
  app.use(require('express').urlencoded({ limit: '1mb', extended: true }));

  // Ensure all responses use keep-alive to prevent ECONNRESET under load
  app.use((_req: any, res: any, next: any) => {
    res.setHeader('Connection', 'keep-alive');
    next();
  });

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [process.env.FRONTEND_URL || 'http://localhost:3000'];

  app.enableCors({
     origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new ForbiddenException('Origin not allowed by CORS'), false);
        }
      },
     credentials: true,
     methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
     preflightContinue: false,
     optionsSuccessStatus: 204,
   });

  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (_req: any, res: any) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
