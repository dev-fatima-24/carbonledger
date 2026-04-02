import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { MarketplaceService } from "./marketplace.service";
import { CreateListingDto, PurchaseDto, BulkPurchaseDto } from "./marketplace.dto";

@Controller("marketplace")
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get("listings")
  findAll(
    @Query("methodology") methodology?: string,
    @Query("vintage")     vintage?: string,
    @Query("country")     country?: string,
    @Query("minPrice")    minPrice?: string,
    @Query("maxPrice")    maxPrice?: string,
  ) {
    return this.marketplaceService.findAll({
      methodology,
      vintage: vintage ? Number(vintage) : undefined,
      country,
      minPrice,
      maxPrice,
    });
  }

  @Get("listings/:id")
  findOne(@Param("id") id: string) {
    return this.marketplaceService.findOne(id);
  }

  @Post("list")
  @UseGuards(AuthGuard("jwt"))
  createListing(@Body() dto: CreateListingDto) {
    return this.marketplaceService.createListing(dto);
  }

  @Delete(":id")
  @UseGuards(AuthGuard("jwt"))
  delist(@Param("id") id: string) {
    return this.marketplaceService.delistListing(id);
  }

  @Post("purchase")
  @UseGuards(AuthGuard("jwt"))
  purchase(@Body() dto: PurchaseDto) {
    return this.marketplaceService.purchase(dto);
  }

  @Post("bulk-purchase")
  @UseGuards(AuthGuard("jwt"))
  bulkPurchase(@Body() dto: BulkPurchaseDto) {
    return this.marketplaceService.bulkPurchase(dto);
  }
}
