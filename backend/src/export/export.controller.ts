import { Controller, Get, Query, Res, UseGuards, Req } from '@nestjs/common';
import { Response, Request } from 'express';
import { ExportService } from './export.service';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { AuthGuard } from '@nestjs/passport';
import { AuditService } from '../audit/audit.service';

@Controller('export')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('regulator')
export class ExportController {
  constructor(
    private readonly exportService: ExportService,
    private readonly auditService: AuditService,
  ) {}

  @Get('projects')
  async exportProjects(
    @Query() filters: any,
    @Query('format') format: string = 'json',
    @Req() req: any,
    @Res() res: Response,
  ) {
    const data = await this.exportService.getProjects(filters);
    
    // Explicitly log the export event in audit trail
    await this.auditService.createLog({
      userId: req.user?.publicKey || 'regulator',
      action: 'EXPORT_PROJECTS',
      ipAddress: req.ip,
      result: 'Success',
      metadata: { filters, format, count: data.length },
    });

    if (format === 'csv') {
      const csv = this.exportService.toCsv(data);
      res.header('Content-Type', 'text/csv');
      res.attachment(`projects-export-${Date.now()}.csv`);
      return res.send(csv);
    }
    return res.json(data);
  }

  @Get('retirements')
  async exportRetirements(
    @Query() filters: any,
    @Query('format') format: string = 'json',
    @Req() req: any,
    @Res() res: Response,
  ) {
    const data = await this.exportService.getRetirements(filters);

    // Explicitly log the export event in audit trail
    await this.auditService.createLog({
      userId: req.user?.publicKey || 'regulator',
      action: 'EXPORT_RETIREMENTS',
      ipAddress: req.ip,
      result: 'Success',
      metadata: { filters, format, count: data.length },
    });

    if (format === 'csv') {
      const csv = this.exportService.toCsv(data);
      res.header('Content-Type', 'text/csv');
      res.attachment(`retirements-export-${Date.now()}.csv`);
      return res.send(csv);
    }
    return res.json(data);
  }
}
