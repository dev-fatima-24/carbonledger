import { IsString, IsInt, IsOptional, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class RegisterProjectDto {
  @IsString() projectId: string;
  @IsString() name: string;
  @IsString() methodology: string;
  @IsString() country: string;
  @IsString() projectType: string;
  @IsString() metadataCid: string;
  @IsString() verifierAddress: string;
  @IsString() ownerAddress: string;
  @IsInt() @Min(2000) @Max(2100) @Type(() => Number) vintageYear: number;
}

export class UpdateProjectStatusDto {
  @IsString() status: string;
  @IsString() @IsOptional() reason?: string;
}
