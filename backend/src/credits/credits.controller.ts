import { Controller, Get, Post, Param, Body, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { CreditsService } from "./credits.service";
import { MintCreditsDto, RetireCreditsDto } from "./credits.dto";

@Controller("credits")
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Post("mint")
  @UseGuards(AuthGuard("jwt"))
  mint(@Body() dto: MintCreditsDto) {
    return this.creditsService.mintCredits(dto);
  }

  @Get("batch/:id")
  getBatch(@Param("id") id: string) {
    return this.creditsService.getBatch(id);
  }

  @Post("retire")
  @UseGuards(AuthGuard("jwt"))
  retire(@Body() dto: RetireCreditsDto) {
    return this.creditsService.retireCredits(dto);
  }

  @Get("retirement/:id")
  getRetirement(@Param("id") id: string) {
    return this.creditsService.getRetirement(id);
  }

  @Get("lookup/:serial")
  lookup(@Param("serial") serial: string) {
    return this.creditsService.lookupSerial(serial);
  }
}
