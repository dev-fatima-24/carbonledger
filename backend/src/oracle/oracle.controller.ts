import { Controller, Get, Post, Param, Body, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { OracleService, SubmitMonitoringDto, UpdatePriceDto, FlagProjectDto, HoldPriceUpdateDto } from "./oracle.service";
import { Roles, RolesGuard } from "../auth/roles.guard";

@Controller("oracle")
export class OracleController {
  constructor(private readonly oracleService: OracleService) {}

  @Post("monitoring")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("verifier", "admin")
  submitMonitoring(@Body() dto: SubmitMonitoringDto) {
    return this.oracleService.submitMonitoring(dto);
  }

  @Post("price")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin")
  updatePrice(@Body() dto: UpdatePriceDto) {
    return { received: true, ...dto };
  }

  @Get("status/:projectId")
  getStatus(@Param("projectId") projectId: string) {
    return this.oracleService.getStatus(projectId);
  }

  @Post("flag")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("verifier", "admin")
  flagProject(@Body() dto: FlagProjectDto) {
    return this.oracleService.flagProject(dto);
  }

  @Post("price-approvals/hold")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin")
  holdPriceUpdate(@Body() dto: HoldPriceUpdateDto) {
    return this.oracleService.holdPriceUpdate(dto);
  }

  @Get("price-approvals")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin")
  getPriceApprovals() {
    return this.oracleService.getPriceApprovals();
  }

  @Post("price-approvals/:id/approve")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin")
  approvePriceUpdate(@Param("id") id: string) {
    return this.oracleService.approvePriceUpdate(id);
  }

  @Post("price-approvals/:id/reject")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin")
  rejectPriceUpdate(@Param("id") id: string, @Body("reason") reason?: string) {
    return this.oracleService.rejectPriceUpdate(id, reason);
  }
}
