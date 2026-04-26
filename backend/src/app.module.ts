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
import { IndexerModule } from "./indexer/indexer.module";
import { PrismaService } from "./prisma.service";

@Controller("health")
class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  check() {
    return {
      status: "ok",
      stellar_network: process.env.STELLAR_NETWORK || "testnet",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("pool")
  pool() {
    return this.prisma.getPoolMetrics();
  }
}

@Module({
  imports: [
    BullModule.forRoot({
      connection: process.env.REDIS_SENTINELS
        ? {
            sentinels: process.env.REDIS_SENTINELS.split(",").map((s) => {
              const [host, port] = s.split(":");
              return { host, port: parseInt(port || "26379") };
            }),
            name: process.env.REDIS_SENTINEL_NAME || "mymaster",
            password: process.env.REDIS_PASSWORD || undefined,
          }
        : {
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
    UploadsModule,
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
