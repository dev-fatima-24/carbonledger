"use client";

import { useState } from "react";
import { useListings } from "../../lib/api";
import { formatStroops, formatTonnes } from "../../lib/carbon-utils";
import { colors } from "../../styles/design-system";
import CreditCard from "../../components/CreditCard";
import MarketplaceFilter, { FilterState } from "../../components/MarketplaceFilter";
import LoadingSkeleton from "../../components/LoadingSkeleton";

export default function MarketplacePage() {
  const [filters, setFilters] = useState<FilterState>({
    methodology: "", vintageYear: "", country: "", minPrice: "", maxPrice: "",
  });

  const { data: listings, isLoading } = useListings({
    methodology: filters.methodology || undefined,
    vintage:     filters.vintageYear ? Number(filters.vintageYear) : undefined,
    country:     filters.country     || undefined,
    minPrice:    filters.minPrice    || undefined,
    maxPrice:    filters.maxPrice    || undefined,
  });

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2.5rem 2rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: colors.neutral[900], margin: "0 0 0.5rem" }}>
          Carbon Credit Marketplace
        </h1>
        <p style={{ color: colors.neutral[500], margin: 0 }}>
          All credits are from verified projects with full satellite monitoring. Prices in USDC.
        </p>
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <MarketplaceFilter filters={filters} onChange={setFilters} />
      </div>

      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
          {Array.from({ length: 9 }).map((_, i) => <LoadingSkeleton key={i} variant="CreditCard" />)}
        </div>
      ) : (
        <>
          <p style={{ fontSize: "0.875rem", color: colors.neutral[500], marginBottom: "1rem" }}>
            {listings?.length ?? 0} listings available
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
            {(listings ?? []).map(l => (
              <CreditCard
                key={l.listingId}
                listing={l}
                onBuy={() => window.location.href = `/buy?listing=${l.listingId}`}
              />
            ))}
          </div>
          {listings?.length === 0 && (
            <div style={{ textAlign: "center", padding: "4rem", color: colors.neutral[400] }}>
              No listings match your filters.
            </div>
          )}
        </>
      )}
    </div>
  );
}
