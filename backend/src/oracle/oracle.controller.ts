import { Controller, Get, Post, Param, Body, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { OracleService, SubmitMonitoringDto, UpdatePriceDto, FlagProjectDto } from "./oracle.service";

@Controller("oracle")
export class OracleController {
  constructor(private readonly oracleService: OracleService) {}

  @Post("monitoring")
  @UseGuards(AuthGuard("jwt"))
  submitMonitoring(@Body() dto: SubmitMonitoringDto) {
    return this.oracleService.submitMonitoring(dto);
  }

  @Post("price")
  @UseGuards(AuthGuard("jwt"))
  updatePrice(@Body() dto: UpdatePriceDto) {
    return { received: true, ...dto };
  }

  @Get("status/:projectId")
  getStatus(@Param("projectId") projectId: string) {
    return this.oracleService.getStatus(projectId);
  }

  @Post("flag")
  @UseGuards(AuthGuard("jwt"))
  flagProject(@Body() dto: FlagProjectDto) {
    return this.oracleService.flagProject(dto);
  }
}
