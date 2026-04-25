import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { BullModule } from "@nestjs/bullmq";
import { AuthModule } from "./auth/auth.module";
import { ProjectsModule } from "./projects/projects.module";
import { CreditsModule } from "./credits/credits.module";
import { RetirementsModule } from "./retirements/retirements.module";
import { MarketplaceModule } from "./marketplace/marketplace.module";
import { OracleModule } from "./oracle/oracle.module";
import { StatsModule } from "./stats/stats.module";
import { QueueModule } from "./queue/queue.module";
import { AuditModule } from "./audit/audit.module";
import { MailModule } from "./mail/mail.module";
import { ExportModule } from "./export/export.module";
import { AuditInterceptor } from "./audit/audit.interceptor";
import { PrismaService } from "./prisma.service";

@Controller("health")
class HealthController {
  @Get()
  check() {
    return {
      status: "ok",
      stellar_network: process.env.STELLAR_NETWORK || "testnet",
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    AuthModule,
    ProjectsModule,
    CreditsModule,
    RetirementsModule,
    MarketplaceModule,
    OracleModule,
    StatsModule,
    QueueModule,
    AuditModule,
    MailModule,
    ExportModule,
  ],
  controllers: [HealthController],
  providers: [
    PrismaService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
