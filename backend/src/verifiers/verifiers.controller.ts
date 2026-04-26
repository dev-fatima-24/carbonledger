import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { VerifiersService } from './verifiers.service';
import { ApplyVerifierDto, ReviewVerifierDto } from './verifiers.dto';

@Controller('verifiers')
export class VerifiersController {
  constructor(private readonly verifiersService: VerifiersService) {}

  /** POST /api/v1/verifiers/apply — verifier submits credentials */
  @Post('apply')
  apply(@Body() dto: ApplyVerifierDto) {
    return this.verifiersService.apply(dto);
  }

  /** GET /api/v1/verifiers?status=pending — admin lists applications */
  @Get()
  @UseGuards(AuthGuard('jwt'))
  findAll(@Query('status') status?: string) {
    return this.verifiersService.findAll(status);
  }

  /** GET /api/v1/verifiers/:id */
  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id') id: string) {
    return this.verifiersService.findOne(id);
  }

  /** PATCH /api/v1/verifiers/:id/review — admin approves or rejects */
  @Patch(':id/review')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  review(@Param('id') id: string, @Body() dto: ReviewVerifierDto) {
    return this.verifiersService.review(id, dto);
  }

  /** GET /api/v1/verifiers/:publicKey/pending-projects — verifier dashboard */
  @Get(':publicKey/pending-projects')
  @UseGuards(AuthGuard('jwt'))
  pendingProjects(@Param('publicKey') publicKey: string) {
    return this.verifiersService.pendingProjects(publicKey);
  }
}
