import { Controller, Get, Post, Param, Body, Query } from "@nestjs/common";
import { RetirementsService } from "./retirements.service";
import { IsString } from "class-validator";

class GeneratePdfDto { @IsString() retirementId: string; }

class VerifyCertificateDto {
  @IsString() retirementId: string;
  @IsString() content: string; // Base64 encoded or raw content
}

@Controller("retirements")
export class RetirementsController {
  constructor(private readonly retirementsService: RetirementsService) {}

  @Get()
  findAll(@Query("limit") limit?: string) {
    return this.retirementsService.findAll(limit ? Number(limit) : 20);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.retirementsService.findOne(id);
  }

  @Get("certificate/:id")
  getCertificate(@Param("id") id: string) {
    return this.retirementsService.findOne(id);
  }

  @Post("generate-pdf")
  generatePdf(@Body() dto: GeneratePdfDto) {
    return this.retirementsService.findOne(dto.retirementId);
  }

  /**
   * Verify certificate content integrity against stored IPFS CID.
   * Prevents certificate tampering via IPFS content substitution.
   * 
   * @param dto Contains retirementId and the fetched certificate content
   * @returns Verification result with integrity status
   */
  @Post("verify-integrity")
  async verifyCertificateIntegrity(@Body() dto: VerifyCertificateDto) {
    return this.retirementsService.verifyCertificateIntegrity(
      dto.retirementId,
      dto.content
    );
  }
}
