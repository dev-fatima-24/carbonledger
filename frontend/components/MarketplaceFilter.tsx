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

const controlStyle: React.CSSProperties = {
  border: `1px solid ${colors.neutral[300]}`,
  borderRadius: "0.375rem",
  padding: "0.5rem 0.75rem",
  fontSize: "0.875rem",
  color: colors.neutral[700],
  background: colors.surface,
  width: "100%",
  boxSizing: "border-box",
};

export default function MarketplaceFilter({ filters, onChange }: Props) {
  const set = (key: keyof FilterState) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
    onChange({ ...filters, [key]: e.target.value });

  return (
    <fieldset style={{
      background: colors.surface,
      border: `1px solid ${colors.neutral[200]}`,
      borderRadius: "0.75rem",
      padding: "1.25rem",
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
      gap: "1rem",
      margin: 0,
    }}>
      <legend style={{
        fontSize: "0.75rem",
        fontWeight: 700,
        color: colors.neutral[600],
        padding: "0 0.25rem",
        float: "left",
        width: "100%",
        marginBottom: "0.5rem",
      }}>
        Filter Credits
      </legend>

      <div>
        <label htmlFor="filter-methodology" style={{ fontSize: "0.75rem", fontWeight: 600, color: colors.neutral[600], display: "block", marginBottom: "0.3rem" }}>
          Methodology
        </label>
        <select id="filter-methodology" style={controlStyle} value={filters.methodology} onChange={set("methodology")}>
          {METHODOLOGIES.map(m => <option key={m} value={m}>{m || "All"}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="filter-vintage" style={{ fontSize: "0.75rem", fontWeight: 600, color: colors.neutral[600], display: "block", marginBottom: "0.3rem" }}>
          Vintage Year
        </label>
        <select id="filter-vintage" style={controlStyle} value={filters.vintageYear} onChange={set("vintageYear")}>
          {VINTAGES.map(v => <option key={v} value={v}>{v || "All"}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="filter-country" style={{ fontSize: "0.75rem", fontWeight: 600, color: colors.neutral[600], display: "block", marginBottom: "0.3rem" }}>
          Country
        </label>
        <select id="filter-country" style={controlStyle} value={filters.country} onChange={set("country")}>
          {COUNTRIES.map(c => <option key={c} value={c}>{c || "All"}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="filter-min-price" style={{ fontSize: "0.75rem", fontWeight: 600, color: colors.neutral[600], display: "block", marginBottom: "0.3rem" }}>
          Min Price (USDC)
        </label>
        <input
          id="filter-min-price"
          type="number"
          style={controlStyle}
          placeholder="0"
          value={filters.minPrice}
          onChange={set("minPrice")}
          min="0"
        />
      </div>

      <div>
        <label htmlFor="filter-max-price" style={{ fontSize: "0.75rem", fontWeight: 600, color: colors.neutral[600], display: "block", marginBottom: "0.3rem" }}>
          Max Price (USDC)
        </label>
        <input
          id="filter-max-price"
          type="number"
          style={controlStyle}
          placeholder="Any"
          value={filters.maxPrice}
          onChange={set("maxPrice")}
          min="0"
        />
      </div>

      <div style={{ display: "flex", alignItems: "flex-end" }}>
        <button
          type="button"
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
    </fieldset>
  );
}
