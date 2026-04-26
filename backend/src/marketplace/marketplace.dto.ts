import { IsString, IsInt, IsNumber, IsPositive, IsOptional, Min, Max } from "class-validator";
import { Type } from "class-transformer";

export class CreateListingDto {
  @IsString() listingId: string;
  @IsString() projectId: string;
  @IsString() batchId: string;
  @IsString() seller: string;
  /** Supports fractional tonnes, e.g. 0.5. Minimum 0.01 tCO₂e. */
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Type(() => Number) amountAvailable: number;
  @IsString() pricePerCredit: string;
  @IsInt() @Min(1990) @Max(2100) @Type(() => Number) vintageYear: number;
  @IsString() methodology: string;
  @IsString() country: string;
}

export class PurchaseDto {
  @IsString() listingId: string;
  /** Supports fractional tonnes, e.g. 0.5. Minimum 0.01 tCO₂e. */
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Type(() => Number) amount: number;
  @IsString() buyerPublicKey: string;
}

export class BulkPurchaseDto {
  @IsString({ each: true }) listingIds: string[];
  @IsNumber({ maxDecimalPlaces: 2 }, { each: true }) amounts: number[];
  @IsString() buyerPublicKey: string;
}

export class ListingsQueryDto {
  @IsString() @IsOptional() methodology?: string;
  @IsInt() @IsOptional() @Type(() => Number) vintage?: number;
  @IsString() @IsOptional() country?: string;
  @IsString() @IsOptional() minPrice?: string;
  @IsString() @IsOptional() maxPrice?: string;
  @IsString() @IsOptional() cursor?: string;
  @IsInt() @Min(1) @Max(100) @Type(() => Number) @IsOptional() limit?: number = 20;
}

export class PaginatedListingsResponse {
  listings: any[];
  next_cursor?: string;
  total_count: number;
}
