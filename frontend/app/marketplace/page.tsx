'use client';

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useListings } from "../../lib/api";
import { formatStroops, formatTonnes } from "../../lib/carbon-utils";
import { colors } from "../../styles/design-system";
import CreditCard from "../../components/CreditCard";
import MarketplaceFilter, { FilterState } from "../../components/MarketplaceFilter";
import LoadingSkeleton from "../../components/LoadingSkeleton";

export default function MarketplacePage() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<FilterState>({
    methodology: "", vintageYear: "", country: "", minPrice: "", maxPrice: "",
  });

  useEffect(() => {
    const vintage = searchParams.get("vintage");
    if (vintage) {
      setFilters((prev) => ({ ...prev, vintageYear: vintage }));
    }
  }, [searchParams]);

  const { data: listings, isLoading } = useListings({
    methodology: filters.methodology || undefined,
    vintage:     filters.vintageYear ? Number(filters.vintageYear) : undefined,
    country:     filters.country     || undefined,
    minPrice:    filters.minPrice    || undefined,
    maxPrice:    filters.maxPrice    || undefined,
  });

  if (isMobile) {
    return (
      <div className="container" style={{ padding: '16px' }}>
        <h1 className="text-center" style={{ fontSize: '24px', marginBottom: '20px' }}>
          Carbon Marketplace
        </h1>
        
        <div className="mobile-card-container">
          {listings.map((item) => (
            <div key={item.id} className="mobile-card">
              <div className="mobile-card-title">{item.project}</div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Amount (tons)</span>
                <span className="mobile-card-value">{item.amount}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Price</span>
                <span className="mobile-card-value">{item.price}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Location</span>
                <span className="mobile-card-value">{item.location}</span>
              </div>
              <button
                style={{
                  width: '100%',
                  marginTop: '12px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  minHeight: '44px',
                  cursor: 'pointer'
                }}
              >
                Purchase
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '24px' }}>
      <h1 style={{ fontSize: '32px', marginBottom: '24px' }}>Carbon Marketplace</h1>
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Amount (tons)</th>
              <th>Price</th>
              <th>Location</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {listings.map((item) => (
              <tr key={item.id}>
                <td>{item.project}</td>
                <td>{item.amount}</td>
                <td>{item.price}</td>
                <td>{item.location}</td>
                <td>
                  <button style={{ padding: '8px 16px', minHeight: '44px' }}>
                    Purchase
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
