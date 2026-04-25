import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ProjectsService } from "./projects.service";
import { RegisterProjectDto, UpdateProjectStatusDto, SearchProjectsDto } from "./projects.dto";
import { IsString, IsOptional } from "class-validator";

class VerifyDto { @IsString() verifierPublicKey: string; }
class RejectDto { @IsString() verifierPublicKey: string; @IsString() reason: string; }

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(
    @Query("methodology") methodology?: string,
    @Query("country")     country?: string,
    @Query("vintage")     vintage?: string,
    @Query("cursor")      cursor?: string,
    @Query("limit")       limit?: string,
  ) {
    return this.projectsService.findAll({
      methodology,
      country,
      vintage: vintage ? Number(vintage) : undefined,
      cursor,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get("search")
  searchProjects(@Query() searchDto: SearchProjectsDto) {
    return this.projectsService.searchProjects(searchDto);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.projectsService.findOne(id);
  }

  @Post("register")
  @UseGuards(AuthGuard("jwt"))
  register(@Body() dto: RegisterProjectDto) {
    return this.projectsService.register(dto);
  }

  @Patch(":id/status")
  @UseGuards(AuthGuard("jwt"))
  updateStatus(@Param("id") id: string, @Body() dto: UpdateProjectStatusDto) {
    return this.projectsService.updateStatus(id, dto);
  }

  @Post(":id/verify")
  @UseGuards(AuthGuard("jwt"))
  verify(@Param("id") id: string, @Body() dto: VerifyDto) {
    return this.projectsService.verify(id, dto.verifierPublicKey);
  }

  @Post(":id/reject")
  @UseGuards(AuthGuard("jwt"))
  reject(@Param("id") id: string, @Body() dto: RejectDto) {
    return this.projectsService.reject(id, dto.verifierPublicKey, dto.reason);
  }
}
