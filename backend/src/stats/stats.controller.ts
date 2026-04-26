import { Controller, Get, Query } from "@nestjs/common";
import { StatsService } from "./stats.service";

@Controller("stats")
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  getStats() {
    return this.statsService.getPlatformStats();
  }

  @Get("leaderboard")
  getLeaderboard(@Query("year") year?: string) {
    return this.statsService.getLeaderboard(year ? parseInt(year, 10) : undefined);
  }
}
