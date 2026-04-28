import { IsString, IsInt, IsPositive, IsOptional, Min, Max, ArrayMaxSize, ArrayMinSize } from "class-validator";
import { Type } from "class-transformer";

export class CreateListingDto {
  @IsString() listingId: string;
  @IsString() projectId: string;
  @IsString() batchId: string;
  // seller is intentionally omitted — always set from req.user.publicKey in the controller
  @IsInt() @IsPositive() @Type(() => Number) amountAvailable: number;
  @IsString() pricePerCredit: string;
  @IsInt() @Min(1990) @Max(2100) @Type(() => Number) vintageYear: number;
  @IsString() methodology: string;
  @IsString() country: string;
}

export class PurchaseDto {
  @IsString() listingId: string;
  @IsInt() @IsPositive() @Type(() => Number) amount: number;
  // buyerPublicKey is set from req.user.publicKey in the controller
  buyerPublicKey?: string;
}

export class BulkPurchaseDto {
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)  // Fix API4: cap bulk operations to prevent resource exhaustion
  listingIds: string[];

  @IsInt({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  amounts: number[];

  // buyerPublicKey is set from req.user.publicKey in the controller
  buyerPublicKey?: string;
}

export class ListingsQueryDto {
  @IsString() @IsOptional() methodology?: string;
  @IsInt() @IsOptional() @Type(() => Number) vintage?: number;
  @IsString() @IsOptional() country?: string;
  @IsString() @IsOptional() minPrice?: string;
  @IsString() @IsOptional() maxPrice?: string;
  @IsString() @IsOptional() search?: string;
  @IsString() @IsOptional() cursor?: string;
  @IsInt() @Min(1) @Max(100) @Type(() => Number) @IsOptional() limit?: number = 20;
}

export class PaginatedListingsResponse {
  listings: any[];
  next_cursor?: string;
  total_count: number;
}
