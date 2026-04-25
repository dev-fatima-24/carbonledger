import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsEnum, IsObject } from 'class-validator';
import { QueueService } from './queue.service';
import { JobType } from './queue.constants';
import { RolesGuard, Roles } from '../auth/roles.guard';

export class EnqueueJobDto {
  @IsEnum(JobType)
  type: JobType;

  @IsObject()
  payload: Record<string, unknown>;
}

@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  /** Enqueue a job (admin only). */
  @Post('jobs')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  enqueue(@Body() dto: EnqueueJobDto) {
    return this.queueService.enqueue(dto.type, dto.payload);
  }

  /** Query a single job status by ID. */
  @Get('jobs/:id')
  @UseGuards(AuthGuard('jwt'))
  getJob(@Param('id') id: string) {
    return this.queueService.getJobStatus(id);
  }

  /** Queue-level stats (admin dashboard). */
  @Get('stats')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  getStats() {
    return this.queueService.getQueueStats();
  }
}
