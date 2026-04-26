import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CreateListingDto, PurchaseDto, BulkPurchaseDto, ListingsQueryDto, PaginatedListingsResponse } from "./marketplace.dto";
import { randomBytes } from "crypto";

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListingsQueryDto): Promise<PaginatedListingsResponse> {
    const { methodology, vintage, country, minPrice, maxPrice, cursor, limit = 20 } = query;

    const where: any = {
      status: { in: ["Active", "PartiallyFilled"] },
      ...(methodology && { methodology }),
      ...(vintage     && { vintageYear: vintage }),
      ...(country     && { country }),
      ...(minPrice    && { pricePerCredit: { gte: minPrice } }),
      ...(maxPrice    && { pricePerCredit: { lte: maxPrice } }),
    };

    const [listings, total_count] = await Promise.all([
      this.prisma.marketListing.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : 0,
      }),
      this.prisma.marketListing.count({ where }),
    ]);

    const hasMore = listings.length > limit;
    const next_cursor = hasMore ? listings[listings.length - 2].id : undefined;
    if (hasMore) listings.pop();

    return { listings, next_cursor, total_count };
  }

  async findOne(listingId: string) {
    const l = await this.prisma.marketListing.findUnique({ where: { listingId } });
    if (!l) throw new NotFoundException(`Listing ${listingId} not found`);
    return l;
  }

  async createListing(dto: CreateListingDto) {
    return this.prisma.marketListing.create({ data: dto });
  }

  async delistListing(listingId: string) {
    await this.findOne(listingId);
    return this.prisma.marketListing.update({
      where: { listingId },
      data:  { status: "Delisted" },
    });
  }

  async purchase(dto: PurchaseDto) {
    const listing = await this.findOne(dto.listingId);
    if (!["Active", "PartiallyFilled"].includes(listing.status)) {
      throw new BadRequestException("Listing is not available");
    }
    const available = Number(listing.amountAvailable);
    if (dto.amount > available) {
      throw new BadRequestException("Insufficient credits in listing");
    }

    const newAmount = parseFloat((available - dto.amount).toFixed(2));
    const newStatus = newAmount === 0 ? "Sold" : "PartiallyFilled";

    await this.prisma.marketListing.update({
      where: { listingId: dto.listingId },
      data:  { amountAvailable: newAmount, status: newStatus },
    });

    return {
      txHash:  randomBytes(32).toString("hex"),
      batchId: listing.batchId,
      amount:  dto.amount,
    };
  }

  async bulkPurchase(dto: BulkPurchaseDto) {
    const results = [];
    for (let i = 0; i < dto.listingIds.length; i++) {
      const result = await this.purchase({
        listingId:      dto.listingIds[i],
        amount:         dto.amounts[i],
        buyerPublicKey: dto.buyerPublicKey,
      });
      results.push(result);
    }
    return results;
  }
}
