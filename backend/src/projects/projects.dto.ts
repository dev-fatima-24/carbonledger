import { IsString, IsInt, IsOptional, Min, Max, Length } from "class-validator";
import { Type } from "class-transformer";

export class RegisterProjectDto {
  @IsString() @Length(1, 64) projectId: string;
  @IsString() @Length(1, 128) name: string;
  @IsString() @Length(1, 64) methodology: string;
  @IsString() @Length(1, 64) country: string;
  @IsString() @Length(1, 64) projectType: string;
  @IsString() @Length(1, 128) metadataCid: string;
  @IsString() verifierAddress: string;
  @IsString() ownerAddress: string;
  @IsInt() @Min(1990) @Max(2027) @Type(() => Number) vintageYear: number;
}

export class UpdateProjectStatusDto {
  @IsString() status: string;
  @IsString() @IsOptional() reason?: string;
}
