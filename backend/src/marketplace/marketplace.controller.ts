import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { MarketplaceService } from "./marketplace.service";
import { CreateListingDto, PurchaseDto, BulkPurchaseDto, ListingsQueryDto } from "./marketplace.dto";

@Controller("marketplace")
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get("listings")
  findAll(@Query() query: ListingsQueryDto) {
    return this.marketplaceService.findAll(query);
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
