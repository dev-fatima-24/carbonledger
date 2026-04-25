import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { RegisterProjectDto, UpdateProjectStatusDto, SearchProjectsDto, PaginatedProjectsResponse, ProjectStatus, OracleFreshness } from "./projects.dto";
import { MailService } from "../mail/mail.service";
import { MailEvent } from "../mail/mail.constants";

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

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

  async searchProjects(searchDto: SearchProjectsDto): Promise<PaginatedProjectsResponse> {
    const { search, methodology, country, status, vintageYear, oracleFreshness, cursor, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = searchDto;

    // Build where clause
    const where: any = {};

    // Full-text search on name and description
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Filter by methodology (array support)
    if (methodology && methodology.length > 0) {
      where.methodology = { in: methodology };
    }

    // Filter by country (array support)
    if (country && country.length > 0) {
      where.country = { in: country };
    }

    // Filter by status (array support)
    if (status && status.length > 0) {
      where.status = { in: status };
    }

    // Filter by vintage year (array support)
    if (vintageYear && vintageYear.length > 0) {
      where.vintageYear = { in: vintageYear };
    }

    // Filter by oracle freshness
    if (oracleFreshness) {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      switch (oracleFreshness) {
        case OracleFreshness.FRESH:
          where.lastMonitoringAt = { gte: thirtyDaysAgo };
          break;
        case OracleFreshness.STALE:
          where.OR = [
            { lastMonitoringAt: { lt: thirtyDaysAgo } },
            { lastMonitoringAt: null }
          ];
          break;
        case OracleFreshness.UNKNOWN:
          where.lastMonitoringAt = null;
          break;
      }
    }

    // Build order by clause
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    // Execute query with cursor-based pagination
    const [projects, total] = await Promise.all([
      this.prisma.carbonProject.findMany({
        where,
        orderBy,
        take: limit + 1, // Get one extra to check if there are more
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : 0,
        select: {
          id: true,
          projectId: true,
          name: true,
          description: true,
          methodology: true,
          country: true,
          projectType: true,
          status: true,
          vintageYear: true,
          totalCreditsIssued: true,
          totalCreditsRetired: true,
          metadataCid: true,
          verifierAddress: true,
          ownerAddress: true,
          coordinates: true,
          lastMonitoringAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.carbonProject.count({ where })
    ]);

    // Determine pagination info
    const hasMore = projects.length > limit;
    const nextCursor = hasMore ? projects[projects.length - 2].id : undefined;
    
    // Remove the extra item if there are more
    if (hasMore) {
      projects.pop();
    }

    return {
      projects,
      nextCursor,
      hasMore,
      total,
    };
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
    const updated = await this.prisma.carbonProject.update({
      where: { projectId },
      data:  { status: "Verified" },
    });

    // Notify owner (assuming we can get email from user profile)
    const owner = await this.prisma.user.findUnique({ where: { publicKey: updated.ownerAddress } });
    if (owner && owner.email && owner.isSubscribed) {
      await this.mailService.sendEmail(owner.email, MailEvent.PROJECT_APPROVED, {
        projectName: updated.name,
        projectId: updated.projectId,
        projectLink: `${process.env.FRONTEND_URL}/projects/${updated.projectId}`,
        to: owner.email,
      });
    }

    return updated;
  }

  async reject(projectId: string, verifierPublicKey: string, reason: string) {
    await this.findOne(projectId);
    return this.prisma.carbonProject.update({
      where: { projectId },
      data:  { status: "Rejected" },
    });
  }
}
