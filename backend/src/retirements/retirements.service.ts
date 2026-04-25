import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { IpfsService } from "../common/ipfs.service";

@Injectable()
export class RetirementsService {
  private readonly logger = new Logger(RetirementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ipfsService: IpfsService,
  ) {}

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

  /**
   * Verify certificate content integrity against stored IPFS CID.
   * Fetches certificate content and compares hash against stored CID.
   * 
   * @param retirementId The retirement record ID
   * @param fetchedContent The certificate content fetched from IPFS
   * @returns Verification result with status and details
   */
  async verifyCertificateIntegrity(retirementId: string, fetchedContent: Buffer | string) {
    const retirement = await this.findOne(retirementId);

    if (!retirement.certificateCid) {
      throw new BadRequestException(
        `Certificate for retirement ${retirementId} has no CID stored - cannot verify integrity`
      );
    }

    try {
      const isValid = this.ipfsService.verifyCidMatch(fetchedContent, retirement.certificateCid);

      if (!isValid) {
        // Mark certificate as invalid due to tampering detection
        await this.prisma.retirementRecord.update({
          where: { retirementId },
          data: {
            isValid: false,
            validatedAt: new Date(),
          },
        });

        this.logger.warn(
          `SECURITY ALERT: Certificate tampering detected for retirement ${retirementId}. ` +
          `Stored CID: ${retirement.certificateCid}, Content hash mismatch.`
        );

        return {
          valid: false,
          retirementId,
          message: "Certificate content integrity verification failed - tampering detected",
          storedCid: retirement.certificateCid,
        };
      }

      // Update validation timestamp on success
      await this.prisma.retirementRecord.update({
        where: { retirementId },
        data: {
          validatedAt: new Date(),
        },
      });

      return {
        valid: true,
        retirementId,
        message: "Certificate content integrity verified",
        storedCid: retirement.certificateCid,
      };
    } catch (error) {
      this.logger.error(
        `Error verifying certificate integrity for ${retirementId}: ${error.message}`
      );
      throw new BadRequestException(
        `Failed to verify certificate integrity: ${error.message}`
      );
    }
  }

  async generatePdf(retirementId: string): Promise<Buffer> {
    // PDF generation is handled client-side via html2canvas + jsPDF
    // This endpoint returns the retirement data for server-side rendering
    const retirement = await this.findOne(retirementId);
    return Buffer.from(JSON.stringify(retirement));
  }
}
