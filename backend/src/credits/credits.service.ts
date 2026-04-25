import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { MintCreditsDto, RetireCreditsDto } from "./credits.dto";
import { MailService } from "../mail/mail.service";
import { MailEvent } from "../mail/mail.constants";
import { randomBytes } from "crypto";

@Injectable()
export class CreditsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async mintCredits(dto: MintCreditsDto) {
    const existing = await this.prisma.creditBatch.findUnique({ where: { batchId: dto.batchId } });
    if (existing) throw new BadRequestException(`Batch ${dto.batchId} already exists`);

    // Check serial range overlap
    const overlap = await this.prisma.creditBatch.findFirst({
      where: {
        OR: [
          { serialStart: { lte: dto.serialEnd }, serialEnd: { gte: dto.serialStart } },
        ],
      },
    });
    if (overlap) throw new BadRequestException("Serial number range overlaps existing batch — double counting prevented");

    const batch = await this.prisma.creditBatch.create({ data: dto });

    // Notify project owner
    const project = await this.prisma.carbonProject.findUnique({ where: { projectId: dto.projectId } });
    const owner = await this.prisma.user.findUnique({ where: { publicKey: project?.ownerAddress || '' } });
    if (owner && owner.email && owner.isSubscribed) {
      await this.mailService.sendEmail(owner.email, MailEvent.CREDITS_MINTED, {
        batchId: batch.batchId,
        amount: batch.amount,
        vintageYear: batch.vintageYear,
        to: owner.email,
      });
    }

    return batch;
  }

  async getBatch(batchId: string) {
    const batch = await this.prisma.creditBatch.findUnique({ where: { batchId } });
    if (!batch) throw new NotFoundException(`Batch ${batchId} not found`);
    return batch;
  }

  async retireCredits(dto: RetireCreditsDto) {
    const batch = await this.getBatch(dto.batchId);

    if (batch.status === "FullyRetired") {
      throw new BadRequestException("Credits are already fully retired — retirement is irreversible");
    }

    const retirementId = `ret-${dto.batchId}-${Date.now()}`;
    const serialStart  = Number(batch.serialStart);
    const serialNumbers = Array.from({ length: dto.amount }, (_, i) => String(serialStart + i));

    // Create retirement record
    const retirement = await this.prisma.retirementRecord.create({
      data: {
        retirementId,
        batchId:          dto.batchId,
        projectId:        batch.projectId,
        amount:           dto.amount,
        retiredBy:        dto.holderPublicKey,
        beneficiary:      dto.beneficiary,
        retirementReason: dto.retirementReason,
        vintageYear:      batch.vintageYear,
        serialNumbers,
        txHash:           randomBytes(32).toString("hex"), // In production: actual Stellar tx hash
      },
    });

    // Update batch status
    const newStatus = dto.amount >= batch.amount ? "FullyRetired" : "PartiallyRetired";
    await this.prisma.creditBatch.update({
      where: { batchId: dto.batchId },
      data:  { status: newStatus },
    });

    // Update project totals
    await this.prisma.carbonProject.update({
      where: { projectId: batch.projectId },
      data:  { totalCreditsRetired: { increment: dto.amount } },
    });

    // Notify beneficiary/holder
    const holder = await this.prisma.user.findUnique({ where: { publicKey: dto.holderPublicKey } });
    if (holder && holder.email && holder.isSubscribed) {
      await this.mailService.sendEmail(holder.email, MailEvent.RETIREMENT_CONFIRMED, {
        retirementId: retirement.retirementId,
        beneficiary: retirement.beneficiary,
        amount: retirement.amount,
        to: holder.email,
      });
    }

    return retirement;
  }

  async getRetirement(retirementId: string) {
    const r = await this.prisma.retirementRecord.findUnique({ where: { retirementId } });
    if (!r) throw new NotFoundException(`Retirement ${retirementId} not found`);
    return r;
  }

  async lookupSerial(serial: string) {
    // Check if serial is in a retirement
    const retirement = await this.prisma.retirementRecord.findFirst({
      where: { serialNumbers: { has: serial } },
    });
    if (retirement) return retirement;

    // Otherwise find the batch containing this serial
    const serialNum = Number(serial);
    const batch = await this.prisma.creditBatch.findFirst({
      where: {
        serialStart: { lte: serial },
        serialEnd:   { gte: serial },
      },
    });
    if (!batch) throw new NotFoundException(`Serial number ${serial} not found`);
    return batch;
  }
}
