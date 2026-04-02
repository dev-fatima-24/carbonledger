import { IsString, IsInt, IsPositive, IsOptional } from "class-validator";
import { Type } from "class-transformer";

export class CreateListingDto {
  @IsString() listingId: string;
  @IsString() projectId: string;
  @IsString() batchId: string;
  @IsString() seller: string;
  @IsInt() @IsPositive() @Type(() => Number) amountAvailable: number;
  @IsString() pricePerCredit: string;
  @IsInt() @IsPositive() @Type(() => Number) vintageYear: number;
  @IsString() methodology: string;
  @IsString() country: string;
}

export class PurchaseDto {
  @IsString() listingId: string;
  @IsInt() @IsPositive() @Type(() => Number) amount: number;
  @IsString() buyerPublicKey: string;
}

export class BulkPurchaseDto {
  @IsString({ each: true }) listingIds: string[];
  @IsInt({ each: true })    amounts: number[];
  @IsString() buyerPublicKey: string;
}
