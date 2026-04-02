import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class RetirementsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(limit = 20) {
    return this.prisma.retirementRecord.findMany({
      orderBy: { retiredAt: "desc" },
      take: limit,
    });
  }

  async findOne(retirementId: string) {
    const r = await this.prisma.retirementRecord.findUnique({ where: { retirementId } });
    if (!r) throw new NotFoundException(`Retirement ${retirementId} not found`);
    return r;
  }

  async generatePdf(retirementId: string): Promise<Buffer> {
    // PDF generation is handled client-side via html2canvas + jsPDF
    // This endpoint returns the retirement data for server-side rendering
    const retirement = await this.findOne(retirementId);
    return Buffer.from(JSON.stringify(retirement));
  }
}
