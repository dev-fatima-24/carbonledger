"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { colors } from "../styles/design-system";

export interface FilterState {
  methodology:  string;
  vintageYear:  string;
  country:      string;
  minPrice:     string;
  maxPrice:     string;
  projectType:  string;
}

export const EMPTY_FILTERS: FilterState = {
  methodology: "", vintageYear: "", country: "",
  minPrice: "", maxPrice: "", projectType: "",
};

/** Build a FilterState from URLSearchParams. */
export function filtersFromParams(params: URLSearchParams): FilterState {
  return {
    methodology: params.get("methodology") ?? "",
    vintageYear: params.get("vintageYear")  ?? "",
    country:     params.get("country")      ?? "",
    minPrice:    params.get("minPrice")     ?? "",
    maxPrice:    params.get("maxPrice")     ?? "",
    projectType: params.get("projectType")  ?? "",
  };
}

interface Props {
  filters:  FilterState;
  onChange: (filters: FilterState) => void;
}

const METHODOLOGIES  = ["", "VCS", "Gold Standard", "ACR", "CAR", "Plan Vivo"];
const COUNTRIES      = ["", "Brazil", "Indonesia", "Kenya", "India", "Colombia", "Peru", "USA"];
const VINTAGES       = ["", "2019", "2020", "2021", "2022", "2023", "2024"];
const PROJECT_TYPES  = ["", "REDD+", "Afforestation", "Soil Carbon", "Renewable Energy", "Methane Capture", "Blue Carbon"];

const fieldStyle: React.CSSProperties = {
  border: `1px solid ${colors.neutral[300]}`,
  borderRadius: "0.375rem",
  padding: "0.5rem 0.75rem",
  fontSize: "0.875rem",
  color: colors.neutral[700],
  background: colors.surface,
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 600,
  color: colors.neutral[600],
  display: "block",
  marginBottom: "0.3rem",
};

function FilterFields({ filters, onChange }: Props) {
  const set = (key: keyof FilterState) =>
    (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
      onChange({ ...filters, [key]: e.target.value });

  return (
    <>
      <div>
        <label style={labelStyle}>Methodology</label>
        <select style={fieldStyle} value={filters.methodology} onChange={set("methodology")}>
          {METHODOLOGIES.map(m => <option key={m} value={m}>{m || "All"}</option>)}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Project Type</label>
        <select style={fieldStyle} value={filters.projectType} onChange={set("projectType")}>
          {PROJECT_TYPES.map(t => <option key={t} value={t}>{t || "All"}</option>)}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Vintage Year</label>
        <select style={fieldStyle} value={filters.vintageYear} onChange={set("vintageYear")}>
          {VINTAGES.map(v => <option key={v} value={v}>{v || "All"}</option>)}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Country</label>
        <select style={fieldStyle} value={filters.country} onChange={set("country")}>
          {COUNTRIES.map(c => <option key={c} value={c}>{c || "All"}</option>)}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Min Price (USDC)</label>
        <input type="number" style={fieldStyle} placeholder="0"
          value={filters.minPrice} onChange={set("minPrice")} min="0" />
      </div>

      <div>
        <label style={labelStyle}>Max Price (USDC)</label>
        <input type="number" style={fieldStyle} placeholder="Any"
          value={filters.maxPrice} onChange={set("maxPrice")} min="0" />
      </div>

      <div style={{ display: "flex", alignItems: "flex-end" }}>
        <button
          onClick={() => onChange(EMPTY_FILTERS)}
          style={{
            background: "transparent",
            color: colors.neutral[500],
            border: `1px solid ${colors.neutral[300]}`,
            borderRadius: "0.375rem",
            padding: "0.5rem 1rem",
            fontSize: "0.8rem",
            cursor: "pointer",
            width: "100%",
          }}
        >
          Clear Filters
        </button>
      </div>
    </>
  );
}

export default function MarketplaceFilter({ filters, onChange }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = useCallback((next: FilterState) => {
    // Sync to URL
    const params = new URLSearchParams(searchParams.toString());
    (Object.keys(next) as (keyof FilterState)[]).forEach(k => {
      if (next[k]) params.set(k, next[k]);
      else params.delete(k);
    });
    router.replace(`?${params.toString()}`, { scroll: false });
    onChange(next);
  }, [onChange, router, searchParams]);

  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <>
      {/* Mobile toggle — visible only on small screens */}
      <button
        onClick={() => setDrawerOpen(true)}
        aria-label="Open filters"
        style={{
          display: "none",
          alignItems: "center",
          gap: "0.5rem",
          background: colors.primary[600],
          color: "#fff",
          border: "none",
          borderRadius: "0.375rem",
          padding: "0.6rem 1rem",
          fontSize: "0.875rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
        className="mf-mobile-btn"
      >
        <span>⚙ Filters</span>
        {activeCount > 0 && (
          <span style={{
            background: "#fff",
            color: colors.primary[700],
            borderRadius: "9999px",
            fontSize: "0.7rem",
            fontWeight: 700,
            padding: "0 0.4rem",
            lineHeight: "1.4",
          }}>{activeCount}</span>
        )}
      </button>

      {/* Desktop inline panel */}
      <div
        className="mf-desktop-panel"
        style={{
          background: colors.surface,
          border: `1px solid ${colors.neutral[200]}`,
          borderRadius: "0.75rem",
          padding: "1.25rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "1rem",
        }}
      >
        <FilterFields filters={filters} onChange={handleChange} />
      </div>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filter options"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
          }}
        >
          {/* Backdrop */}
          <div
            onClick={() => setDrawerOpen(false)}
            style={{ flex: 1, background: "rgba(0,0,0,0.4)" }}
          />
          {/* Panel */}
          <div style={{
            width: "min(85vw, 320px)",
            background: colors.surface,
            padding: "1.5rem",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <span style={{ fontWeight: 700, fontSize: "1rem", color: colors.neutral[900] }}>Filters</span>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close filters"
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: colors.neutral[500] }}
              >
                ✕
              </button>
            </div>
            <FilterFields filters={filters} onChange={(next) => { handleChange(next); }} />
            <button
              onClick={() => setDrawerOpen(false)}
              style={{
                marginTop: "0.5rem",
                background: colors.primary[600],
                color: "#fff",
                border: "none",
                borderRadius: "0.375rem",
                padding: "0.65rem",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              Show Results
            </button>
          </div>
        </div>
      )}

      {/* Responsive styles via a style tag — avoids adding a CSS file */}
      <style>{`
        @media (max-width: 640px) {
          .mf-mobile-btn   { display: flex !important; }
          .mf-desktop-panel { display: none !important; }
        }
      `}</style>
    </>
  );
}
