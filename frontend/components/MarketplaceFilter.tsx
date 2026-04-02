"use client";

import { colors } from "../styles/design-system";

export interface FilterState {
  methodology: string;
  vintageYear: string;
  country: string;
  minPrice: string;
  maxPrice: string;
}

interface Props {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

const METHODOLOGIES = ["", "VCS", "Gold Standard", "ACR", "CAR", "Plan Vivo"];
const COUNTRIES     = ["", "Brazil", "Indonesia", "Kenya", "India", "Colombia", "Peru", "USA"];
const VINTAGES      = ["", "2019", "2020", "2021", "2022", "2023", "2024"];

const selectStyle: React.CSSProperties = {
  border: `1px solid ${colors.neutral[300]}`,
  borderRadius: "0.375rem",
  padding: "0.5rem 0.75rem",
  fontSize: "0.875rem",
  color: colors.neutral[700],
  background: colors.surface,
  width: "100%",
};

const inputStyle: React.CSSProperties = {
  ...selectStyle,
};

export default function MarketplaceFilter({ filters, onChange }: Props) {
  const set = (key: keyof FilterState) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
    onChange({ ...filters, [key]: e.target.value });

  return (
    <div style={{
      background: colors.surface,
      border: `1px solid ${colors.neutral[200]}`,
      borderRadius: "0.75rem",
      padding: "1.25rem",
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
      gap: "1rem",
    }}>
      <div>
        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: colors.neutral[600], display: "block", marginBottom: "0.3rem" }}>
          Methodology
        </label>
        <select style={selectStyle} value={filters.methodology} onChange={set("methodology")}>
          {METHODOLOGIES.map(m => <option key={m} value={m}>{m || "All"}</option>)}
        </select>
      </div>

      <div>
        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: colors.neutral[600], display: "block", marginBottom: "0.3rem" }}>
          Vintage Year
        </label>
        <select style={selectStyle} value={filters.vintageYear} onChange={set("vintageYear")}>
          {VINTAGES.map(v => <option key={v} value={v}>{v || "All"}</option>)}
        </select>
      </div>

      <div>
        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: colors.neutral[600], display: "block", marginBottom: "0.3rem" }}>
          Country
        </label>
        <select style={selectStyle} value={filters.country} onChange={set("country")}>
          {COUNTRIES.map(c => <option key={c} value={c}>{c || "All"}</option>)}
        </select>
      </div>

      <div>
        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: colors.neutral[600], display: "block", marginBottom: "0.3rem" }}>
          Min Price (USDC)
        </label>
        <input
          type="number"
          style={inputStyle}
          placeholder="0"
          value={filters.minPrice}
          onChange={set("minPrice")}
          min="0"
        />
      </div>

      <div>
        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: colors.neutral[600], display: "block", marginBottom: "0.3rem" }}>
          Max Price (USDC)
        </label>
        <input
          type="number"
          style={inputStyle}
          placeholder="Any"
          value={filters.maxPrice}
          onChange={set("maxPrice")}
          min="0"
        />
      </div>

      <div style={{ display: "flex", alignItems: "flex-end" }}>
        <button
          onClick={() => onChange({ methodology: "", vintageYear: "", country: "", minPrice: "", maxPrice: "" })}
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
    </div>
  );
}
