"use client";

import { colors } from "../styles/design-system";

type Variant = "CreditCard" | "MarketplaceItem" | "PoolStats" | "LoanCard";

interface Props {
  variant?: Variant;
  count?: number;
}

function Shimmer({ width, height, borderRadius = "0.375rem" }: { width: string; height: string; borderRadius?: string }) {
  return (
    <div style={{
      width,
      height,
      borderRadius,
      background: `linear-gradient(90deg, ${colors.neutral[100]} 25%, ${colors.neutral[200]} 50%, ${colors.neutral[100]} 75%)`,
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
    }} />
  );
}

function CreditCardSkeleton() {
  return (
    <div style={{
      background: colors.surface,
      border: `1px solid ${colors.neutral[200]}`,
      borderRadius: "0.75rem",
      padding: "1.5rem",
      display: "flex",
      flexDirection: "column",
      gap: "1rem",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <Shimmer width="80px" height="12px" />
          <Shimmer width="160px" height="18px" />
        </div>
        <Shimmer width="60px" height="22px" borderRadius="9999px" />
      </div>
      <Shimmer width="80px" height="22px" borderRadius="0.375rem" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          <Shimmer width="60px" height="10px" />
          <Shimmer width="100px" height="16px" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          <Shimmer width="80px" height="10px" />
          <Shimmer width="90px" height="16px" />
        </div>
      </div>
      <Shimmer width="100%" height="36px" borderRadius="0.5rem" />
    </div>
  );
}

function MarketplaceItemSkeleton() {
  return (
    <div style={{
      background: colors.surface,
      border: `1px solid ${colors.neutral[200]}`,
      borderRadius: "0.5rem",
      padding: "1rem",
      display: "grid",
      gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
      gap: "1rem",
      alignItems: "center",
    }}>
      {[200, 100, 80, 90, 60].map((w, i) => (
        <Shimmer key={i} width={`${w}px`} height="16px" />
      ))}
    </div>
  );
}

function PoolStatsSkeleton() {
  return (
    <div style={{
      background: colors.surface,
      border: `1px solid ${colors.neutral[200]}`,
      borderRadius: "0.75rem",
      padding: "1.5rem",
      display: "flex",
      flexDirection: "column",
      gap: "0.75rem",
    }}>
      <Shimmer width="120px" height="14px" />
      <Shimmer width="80px" height="32px" />
      <Shimmer width="160px" height="12px" />
    </div>
  );
}

export default function LoadingSkeleton({ variant = "CreditCard", count = 1 }: Props) {
  const skeletons = Array.from({ length: count });

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
      `}</style>
      {skeletons.map((_, i) => {
        if (variant === "CreditCard")      return <CreditCardSkeleton key={i} />;
        if (variant === "MarketplaceItem") return <MarketplaceItemSkeleton key={i} />;
        if (variant === "PoolStats")       return <PoolStatsSkeleton key={i} />;
        return <CreditCardSkeleton key={i} />;
      })}
    </>
  );
}
