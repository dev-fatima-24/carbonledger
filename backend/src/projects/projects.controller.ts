import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ProjectsService } from "./projects.service";
import { RegisterProjectDto, UpdateProjectStatusDto, SearchProjectsDto } from "./projects.dto";
import { Roles, RolesGuard } from "../auth/roles.guard";
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
    // Sanitize: reject non-string values (e.g. operator injection via ?methodology[$ne]=VCS)
    const safeMethodology = typeof methodology === "string" ? methodology : undefined;
    const safeCountry     = typeof country     === "string" ? country     : undefined;
    return this.projectsService.findAll({
      methodology: safeMethodology,
      country:     safeCountry,
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
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("project_developer", "admin")
  register(@Body() dto: RegisterProjectDto) {
    return this.projectsService.register(dto);
  }

  @Patch(":id/status")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("admin")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateProjectStatusDto) {
    return this.projectsService.updateStatus(id, dto);
  }

  @Post(":id/verify")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("verifier", "admin")
  verify(@Param("id") id: string, @Body() dto: VerifyDto) {
    return this.projectsService.verify(id, dto.verifierPublicKey);
  }

  @Post(":id/reject")
  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles("verifier", "admin")
  reject(@Param("id") id: string, @Body() dto: RejectDto) {
    return this.projectsService.reject(id, dto.verifierPublicKey, dto.reason);
  }
}
