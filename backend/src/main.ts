import { NestFactory } from '@nestjs/core';
import { ConsoleLogger, LogLevel } from '@nestjs/common';
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
  app.enableCors({ origin: process.env.FRONTEND_URL });

  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (_req: any, res: any) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
