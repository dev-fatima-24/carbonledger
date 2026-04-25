import { IsString, IsInt, IsOptional, Min, Max, IsBoolean, IsEnum, IsArray } from "class-validator";
import { Type, Transform } from "class-transformer";

export class RegisterProjectDto {
  @IsString() projectId: string;
  @IsString() name: string;
  @IsString() @IsOptional() description?: string;
  @IsString() methodology: string;
  @IsString() country: string;
  @IsString() projectType: string;
  @IsString() metadataCid: string;
  @IsString() verifierAddress: string;
  @IsString() ownerAddress: string;
  @IsInt() @Min(1990) @Max(2100) @Type(() => Number) vintageYear: number;
}

export class UpdateProjectStatusDto {
  @IsString() status: string;
  @IsString() @IsOptional() reason?: string;
}

export enum ProjectStatus {
  PENDING = 'Pending',
  VERIFIED = 'Verified',
  REJECTED = 'Rejected',
  SUSPENDED = 'Suspended',
  COMPLETED = 'Completed',
  CERTIFIED = 'Certified'
}

export enum OracleFreshness {
  FRESH = 'fresh',
  STALE = 'stale',
  UNKNOWN = 'unknown'
}

export class SearchProjectsDto {
  @IsString() @IsOptional() search?: string;
  
  @IsArray() @IsString({ each: true }) @IsOptional()
  @Transform(({ value }) => Array.isArray(value) ? value : [value])
  methodology?: string[];
  
  @IsArray() @IsString({ each: true }) @IsOptional()
  @Transform(({ value }) => Array.isArray(value) ? value : [value])
  country?: string[];
  
  @IsArray() @IsEnum(ProjectStatus, { each: true }) @IsOptional()
  @Transform(({ value }) => Array.isArray(value) ? value : [value])
  status?: ProjectStatus[];
  
  @IsArray() @IsInt({ each: true }) @Min(2000) @Max(2100) @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => Array.isArray(value) ? value : [value])
  vintageYear?: number[];
  
  @IsEnum(OracleFreshness) @IsOptional() oracleFreshness?: OracleFreshness;
  
  @IsString() @IsOptional() cursor?: string;
  
  @IsInt() @Min(1) @Max(100) @Type(() => Number) @IsOptional()
  limit?: number = 20;
  
  @IsString() @IsOptional() sortBy?: 'createdAt' | 'vintageYear' | 'totalCreditsIssued' | 'name';
  
  @IsEnum(['asc', 'desc']) @IsOptional() sortOrder?: 'asc' | 'desc' = 'desc';
}

export class PaginatedProjectsResponse {
  projects: any[];
  nextCursor?: string;
  hasMore: boolean;
  total: number;
}
