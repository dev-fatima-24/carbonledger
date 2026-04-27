import { Module } from "@nestjs/common";
import { RetirementsController } from "./retirements.controller";
import { RetirementsService } from "./retirements.service";
import { RetirementIndexerService } from "./retirement-indexer.service";
import { PrismaService } from "../prisma.service";
import { AuthModule } from "../auth/auth.module";
import { IpfsService } from "../common/ipfs.service";

@Module({
  imports: [AuthModule, QueueModule],
  controllers: [RetirementsController],
  providers: [RetirementsService, PrismaService, IpfsService],
})
export class RetirementsModule {}
