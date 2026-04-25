import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Body,
  Res,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Response } from "express";
import { RetirementsService } from "./retirements.service";
import { ExportRetirementsDto } from "./retirements.dto";

class VerifyCertificateDto {
  @IsString() retirementId: string;
  @IsString() content: string; // Base64 encoded or raw content
}

@Controller("retirements")
export class RetirementsController {
  constructor(private readonly retirementsService: RetirementsService) {}

  @Get()
  findAll(
    @Query("cursor") cursor?: string,
    @Query("limit")  limit?: string,
  ) {
    return this.retirementsService.findAll(cursor, limit ? Number(limit) : 20);
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
  generatePdf(@Body('retirementId') retirementId: string) {
    return this.retirementsService.generatePdf(retirementId);
  }

  @Get("export/csv")
  @UseGuards(AuthGuard("jwt"))
  async exportCsv(@Query() filters: ExportRetirementsDto, @Res({ passthrough: true }) res: Response) {
    const csvBuffer = await this.retirementsService.exportCsv(filters);
    res.set({
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="esg-retirements-${new Date().toISOString().split("T")[0]}.csv"`,
      "Content-Length": csvBuffer.length,
    });
    return csvBuffer;
  }

  @Get("export/pdf")
  @UseGuards(AuthGuard("jwt"))
  async exportPdf(@Query() filters: ExportRetirementsDto, @Res({ passthrough: true }) res: Response) {
    const pdfBuffer = await this.retirementsService.exportPdf(filters);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="esg-report-${new Date().toISOString().split("T")[0]}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });
    return pdfBuffer;
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
