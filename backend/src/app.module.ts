import { Module, Controller, Get } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AuthModule } from "./auth/auth.module";
import { ProjectsModule } from "./projects/projects.module";
import { CreditsModule } from "./credits/credits.module";
import { RetirementsModule } from "./retirements/retirements.module";
import { MarketplaceModule } from "./marketplace/marketplace.module";
import { OracleModule } from "./oracle/oracle.module";
import { StatsModule } from "./stats/stats.module";
import { QueueModule } from "./queue/queue.module";
import { UploadsModule } from "./uploads/uploads.module";
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
    UploadsModule,
  ],
  controllers: [HealthController],
  providers: [PrismaService],
})
export class AppModule {}
