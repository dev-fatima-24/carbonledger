import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { RegisterProjectDto, UpdateProjectStatusDto } from "./projects.dto";

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: { methodology?: string; country?: string; vintage?: number }) {
    return this.prisma.carbonProject.findMany({
      where: {
        ...(filters.methodology && { methodology: filters.methodology }),
        ...(filters.country     && { country: filters.country }),
        ...(filters.vintage     && { vintageYear: filters.vintage }),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(projectId: string) {
    const project = await this.prisma.carbonProject.findUnique({ where: { projectId } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    return project;
  }

  async register(dto: RegisterProjectDto) {
    const existing = await this.prisma.carbonProject.findUnique({ where: { projectId: dto.projectId } });
    if (existing) throw new ConflictException(`Project ${dto.projectId} already exists`);
    return this.prisma.carbonProject.create({ data: dto });
  }

  async updateStatus(projectId: string, dto: UpdateProjectStatusDto) {
    await this.findOne(projectId);
    return this.prisma.carbonProject.update({
      where: { projectId },
      data:  { status: dto.status },
    });
  }

  async verify(projectId: string, verifierPublicKey: string) {
    await this.findOne(projectId);
    return this.prisma.carbonProject.update({
      where: { projectId },
      data:  { status: "Verified" },
    });
  }

  async reject(projectId: string, verifierPublicKey: string, reason: string) {
    await this.findOne(projectId);
    return this.prisma.carbonProject.update({
      where: { projectId },
      data:  { status: "Rejected" },
    });
  }
}
