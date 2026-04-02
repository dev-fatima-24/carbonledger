import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { IsString, IsInt, IsPositive } from "class-validator";
import { Type } from "class-transformer";

export class SubmitMonitoringDto {
  @IsString() projectId: string;
  @IsString() period: string;
  @IsInt() @IsPositive() @Type(() => Number) tonnesVerified: number;
  @IsInt() @Type(() => Number) methodologyScore: number;
  @IsString() satelliteCid: string;
  @IsString() submittedBy: string;
}

export class UpdatePriceDto {
  @IsString() methodology: string;
  @IsInt() @Type(() => Number) vintageYear: number;
  @IsString() priceUsdc: string;
}

export class FlagProjectDto {
  @IsString() projectId: string;
  @IsString() reason: string;
}

@Injectable()
export class OracleService {
  constructor(private readonly prisma: PrismaService) {}

  async submitMonitoring(dto: SubmitMonitoringDto) {
    return this.prisma.monitoringData.upsert({
      where:  { projectId_period: { projectId: dto.projectId, period: dto.period } },
      update: { tonnesVerified: dto.tonnesVerified, methodologyScore: dto.methodologyScore, satelliteCid: dto.satelliteCid },
      create: {
        projectId:        dto.projectId,
        period:           dto.period,
        tonnesVerified:   dto.tonnesVerified,
        methodologyScore: dto.methodologyScore,
        satelliteCid:     dto.satelliteCid,
        submittedBy:      dto.submittedBy,
      },
    });
  }

  async getStatus(projectId: string) {
    const latest = await this.prisma.monitoringData.findFirst({
      where:   { projectId },
      orderBy: { submittedAt: "desc" },
    });

    const FRESHNESS_MS = 365 * 24 * 60 * 60 * 1000;
    const isCurrent = latest
      ? Date.now() - latest.submittedAt.getTime() <= FRESHNESS_MS
      : false;

    return {
      projectId,
      lastSubmittedAt: latest?.submittedAt ?? null,
      isCurrent,
      latestScore: latest?.methodologyScore ?? null,
    };
  }

  async flagProject(dto: FlagProjectDto) {
    await this.prisma.carbonProject.update({
      where: { projectId: dto.projectId },
      data:  { status: "Suspended" },
    });
    return { flagged: true, projectId: dto.projectId, reason: dto.reason };
  }
}
