import { Controller, Get, Post, Param, Body, UseGuards, Request } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Throttle } from "@nestjs/throttler";
import { CreditsService } from "./credits.service";
import { MintCreditsDto, RetireCreditsDto } from "./credits.dto";
import { Roles, RolesGuard } from "../auth/roles.guard";

@Controller("credits")
export class CreditsController {
  constructor(private readonly creditsService: CreditsService) {}

  @Post("mint")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin")
  mint(@Body() dto: MintCreditsDto) {
    return this.creditsService.mintCredits(dto);
  }

  @Get("batch/:id")
  getBatch(@Param("id") id: string) {
    return this.creditsService.getBatch(id);
  }

  @Post("retire")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("corporation", "admin")
  @Throttle({ retire: { ttl: 60_000, limit: 10 } })  // Fix API6: 10 retirements per minute
  retire(@Body() dto: RetireCreditsDto, @Request() req: any) {
    // Fix mass assignment: derive retiredBy from the authenticated JWT, not the body
    const authedDto = { ...dto, holderPublicKey: req.user.publicKey };
    return this.creditsService.retireCredits(authedDto);
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
