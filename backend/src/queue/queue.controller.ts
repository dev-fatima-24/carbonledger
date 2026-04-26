import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsEnum, IsObject } from 'class-validator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiProperty } from '@nestjs/swagger';
import { QueueService } from './queue.service';
import { JobType } from './queue.constants';
import { RolesGuard, Roles } from '../auth/roles.guard';

export class EnqueueJobDto {
  @ApiProperty({ enum: Object.values(JobType), example: JobType.CERTIFICATE_GENERATION })
  @IsEnum(JobType)
  type: JobType;

  @ApiProperty({ example: { projectId: 'proj-001', amount: 1000 } })
  @IsObject()
  payload: Record<string, unknown>;
}

@ApiTags("Queue")
@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post('jobs')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Enqueue a background job (admin only)" })
  @ApiResponse({ status: 201, description: "Job enqueued — returns job ID" })
  @ApiResponse({ status: 401, description: "Unauthorized — admin JWT required" })
  enqueue(@Body() dto: EnqueueJobDto) {
    return this.queueService.enqueue(dto.type, dto.payload);
  }

  @Get('jobs/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get job status by ID" })
  @ApiParam({ name: 'id', example: 'job-001' })
  @ApiResponse({ status: 200, description: "Job status and result" })
  @ApiResponse({ status: 401, description: "Unauthorized — JWT required" })
  @ApiResponse({ status: 404, description: "Job not found" })
  getJob(@Param('id') id: string) {
    return this.queueService.getJobStatus(id);
  }

  @Get('stats')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get queue statistics (admin only)" })
  @ApiResponse({ status: 200, description: "Queue depth, active, completed, and failed counts" })
  @ApiResponse({ status: 401, description: "Unauthorized — admin JWT required" })
  getStats() {
    return this.queueService.getQueueStats();
  }
}
