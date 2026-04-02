import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlatformStats() {
    const [projects, retirements, listings] = await Promise.all([
      this.prisma.carbonProject.aggregate({
        _sum: { totalCreditsIssued: true, totalCreditsRetired: true },
        _count: { _all: true },
        where: { status: "Verified" },
      }),
      this.prisma.retirementRecord.aggregate({ _sum: { amount: true } }),
      this.prisma.marketListing.aggregate({
        _count: { _all: true },
        where: { status: { in: ["Active", "PartiallyFilled"] } },
      }),
    ]);

    return {
      totalCreditsIssued:  projects._sum.totalCreditsIssued  ?? 0,
      totalCreditsRetired: projects._sum.totalCreditsRetired ?? 0,
      activeProjects:      projects._count._all,
      marketplaceVolume:   "0", // Would sum completed purchase amounts
    };
  }
}
