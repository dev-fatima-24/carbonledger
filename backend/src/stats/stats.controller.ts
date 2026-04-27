import { Controller, Get } from "@nestjs/common";
import { StatsService } from "./stats.service";
import { getCacheMetrics } from "../marketplace/listings-cache.service";

@Controller("stats")
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  getStats() {
    return this.statsService.getPlatformStats();
  }

  @Get("cache")
  getCacheStats() {
    return { listings: getCacheMetrics() };
  }
}
