import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  // In production, add @UseGuards(AdminGuard) here
  async getLogs(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
  ) {
    return this.auditService.findAll({ limit, offset, userId, action });
  }
}
