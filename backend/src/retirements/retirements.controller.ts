import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Body,
  Res,
  Request,
  ForbiddenException,
  HttpCode,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Response } from "express";
import { RetirementsService } from "./retirements.service";
import { ExportRetirementsDto } from "./retirements.dto";
import { IsString } from "class-validator";

class VerifyCertificateDto {
  @IsString() retirementId: string;
  @IsString() content: string;
}

@Controller("retirements")
export class RetirementsController {
  constructor(private readonly retirementsService: RetirementsService) {}

  // Fix IDOR: require auth; scope list to the caller's own retirements
  @Get()
  @UseGuards(AuthGuard("jwt"))
  findAll(
    @Request() req: any,
    @Query("cursor") cursor?: string,
    @Query("limit")  limit?: string,
  ) {
    return this.retirementsService.findAll(cursor, limit ? Number(limit) : 20, req.user.publicKey);
  }

  // Fix IDOR: require auth; only the owner or admin may read a specific retirement
  @Get(":id")
  @UseGuards(AuthGuard("jwt"))
  async findOne(@Param("id") id: string, @Request() req: any) {
    const retirement = await this.retirementsService.findOne(id);
    if (retirement.retiredBy !== req.user.publicKey && req.user.role !== "admin") {
      throw new ForbiddenException("Access denied");
    }
    return retirement;
  }

  // Certificate lookup is intentionally public (audit trail)
  @Get("certificate/:id")
  getCertificate(@Param("id") id: string) {
    return this.retirementsService.findOne(id);
  }

  @Post("generate-pdf")
  generatePdf(@Body("retirementId") retirementId: string) {
    return this.retirementsService.generatePdf(retirementId);
  }

  @Get("export/csv")
  @UseGuards(AuthGuard("jwt"))
  async exportCsv(
    @Query() filters: ExportRetirementsDto,
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Fix IDOR: scope export to the caller's own retirements
    const scopedFilters = { ...filters, retiredBy: req.user.publicKey };
    const csvBuffer = await this.retirementsService.exportCsv(scopedFilters);
    res.set({
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="esg-retirements-${new Date().toISOString().split("T")[0]}.csv"`,
      "Content-Length": csvBuffer.length,
    });
    return csvBuffer;
  }

  @Get("export/pdf")
  @UseGuards(AuthGuard("jwt"))
  async exportPdf(
    @Query() filters: ExportRetirementsDto,
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const scopedFilters = { ...filters, retiredBy: req.user.publicKey };
    const pdfBuffer = await this.retirementsService.exportPdf(scopedFilters);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="esg-report-${new Date().toISOString().split("T")[0]}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });
    return pdfBuffer;
  }

  @Post("verify-integrity")
  @HttpCode(200)
  async verifyCertificateIntegrity(@Body() dto: VerifyCertificateDto) {
    return this.retirementsService.verifyCertificateIntegrity(dto.retirementId, dto.content);
  }
}
