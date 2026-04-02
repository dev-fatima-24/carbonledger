import { IsString, IsInt, IsPositive } from "class-validator";
import { Type } from "class-transformer";

export class MintCreditsDto {
  @IsString() batchId: string;
  @IsString() projectId: string;
  @IsInt() @IsPositive() @Type(() => Number) vintageYear: number;
  @IsInt() @IsPositive() @Type(() => Number) amount: number;
  @IsString() serialStart: string;
  @IsString() serialEnd: string;
  @IsString() metadataCid: string;
}

export class RetireCreditsDto {
  @IsString() batchId: string;
  @IsInt() @IsPositive() @Type(() => Number) amount: number;
  @IsString() beneficiary: string;
  @IsString() retirementReason: string;
  @IsString() holderPublicKey: string;
}
