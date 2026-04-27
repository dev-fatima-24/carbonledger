import { IsString, IsInt, IsNumber, IsPositive, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class MintCreditsDto {
  @IsString() batchId: string;
  @IsString() projectId: string;
  @IsInt() @IsPositive() @Min(1990) @Max(2027) @Type(() => Number) vintageYear: number;
  /** Supports fractional tonnes, e.g. 0.5. Minimum 0.01 tCO₂e. */
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Type(() => Number) amount: number;
  @IsString() serialStart: string;
  @IsString() serialEnd: string;
  @IsString() metadataCid: string;
}

export class RetireCreditsDto {
  @IsString() batchId: string;
  /** Supports fractional tonnes, e.g. 0.5. Minimum 0.01 tCO₂e. */
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Type(() => Number) amount: number;
  @IsString() beneficiary: string;
  @IsString() retirementReason: string;
  @IsString() holderPublicKey: string;
}
