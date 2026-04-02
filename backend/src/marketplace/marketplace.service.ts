import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CreateListingDto, PurchaseDto, BulkPurchaseDto } from "./marketplace.dto";
import { randomBytes } from "crypto";

@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: { methodology?: string; vintage?: number; country?: string; minPrice?: string; maxPrice?: string }) {
    return this.prisma.marketListing.findMany({
      where: {
        status: { in: ["Active", "PartiallyFilled"] },
        ...(filters.methodology && { methodology: filters.methodology }),
        ...(filters.vintage     && { vintageYear: filters.vintage }),
        ...(filters.country     && { country: filters.country }),
      },
      orderBy: { createdAt: "desc" },
    });
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
    if (dto.amount > listing.amountAvailable) {
      throw new BadRequestException("Insufficient credits in listing");
    }

    const newAmount = listing.amountAvailable - dto.amount;
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
