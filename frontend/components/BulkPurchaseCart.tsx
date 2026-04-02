"use client";

import { useState } from "react";
import { MarketListing } from "../lib/api";
import { formatStroops, formatTonnes } from "../lib/carbon-utils";
import { colors } from "../styles/design-system";

interface CartItem {
  listing: MarketListing;
  amount: number;
}

interface Props {
  onCheckout: (items: CartItem[]) => void;
}

export default function BulkPurchaseCart({ onCheckout }: Props) {
  const [items, setItems] = useState<CartItem[]>([]);

  function addItem(listing: MarketListing, amount: number) {
    setItems(prev => {
      const existing = prev.findIndex(i => i.listing.listingId === listing.listingId);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], amount };
        return updated;
      }
      return [...prev, { listing, amount }];
    });
  }

  function removeItem(listingId: string) {
    setItems(prev => prev.filter(i => i.listing.listingId !== listingId));
  }

  const totalStroops = items.reduce((sum, item) => {
    return sum + BigInt(item.listing.pricePerCredit) * BigInt(item.amount);
  }, 0n);

  const totalTonnes = items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div style={{
      background: colors.surface,
      border: `1px solid ${colors.neutral[200]}`,
      borderRadius: "0.75rem",
      padding: "1.5rem",
    }}>
      <h3 style={{ fontSize: "1rem", fontWeight: 700, color: colors.neutral[900], margin: "0 0 1rem" }}>
        Purchase Cart ({items.length} project{items.length !== 1 ? "s" : ""})
      </h3>

      {items.length === 0 ? (
        <p style={{ color: colors.neutral[400], fontSize: "0.875rem", textAlign: "center", padding: "2rem 0" }}>
          Add credits from the marketplace to build your portfolio
        </p>
      ) : (
        <>
          {items.map(({ listing, amount }) => (
            <div key={listing.listingId} style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.75rem 0",
              borderBottom: `1px solid ${colors.neutral[100]}`,
            }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: "0.875rem", color: colors.neutral[800], margin: 0 }}>
                  {listing.projectName || listing.projectId}
                </p>
                <p style={{ fontSize: "0.75rem", color: colors.neutral[500], margin: "0.1rem 0 0" }}>
                  {listing.methodology} · {listing.vintageYear} · {amount} tCO₂e
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontWeight: 700, color: colors.primary[700], fontSize: "0.9rem" }}>
                  ${formatStroops(BigInt(listing.pricePerCredit) * BigInt(amount))}
                </span>
                <button
                  onClick={() => removeItem(listing.listingId)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: colors.neutral[400],
                    cursor: "pointer",
                    fontSize: "1rem",
                    padding: "0.2rem",
                  }}
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}

          {/* Totals */}
          <div style={{ marginTop: "1rem", padding: "1rem", background: colors.primary[50], borderRadius: "0.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.875rem", color: colors.neutral[600] }}>Total CO₂e</span>
              <span style={{ fontWeight: 700, color: colors.neutral[800] }}>{formatTonnes(totalTonnes)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.875rem", color: colors.neutral[600] }}>Total Cost</span>
              <span style={{ fontWeight: 700, color: colors.primary[700], fontSize: "1.1rem" }}>
                ${formatStroops(totalStroops)} USDC
              </span>
            </div>
          </div>

          <button
            onClick={() => onCheckout(items)}
            style={{
              background: colors.primary[600],
              color: "#fff",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.75rem",
              fontSize: "0.9rem",
              fontWeight: 700,
              cursor: "pointer",
              width: "100%",
              marginTop: "1rem",
            }}
          >
            Purchase {formatTonnes(totalTonnes)} of Carbon Credits
          </button>
        </>
      )}
    </div>
  );
}
