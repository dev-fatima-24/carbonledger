"use client";

import { useState } from "react";
import { useSerialLookup } from "../lib/api";
import { colors } from "../styles/design-system";

export default function SerialNumberLookup() {
  const [serial, setSerial] = useState("");
  const [search, setSearch] = useState("");
  const { data, isLoading, error } = useSerialLookup(search);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(serial.trim());
  }

  return (
    <div style={{
      background: colors.surface,
      border: `1px solid ${colors.neutral[200]}`,
      borderRadius: "0.75rem",
      padding: "1.5rem",
    }}>
      <h3 style={{ fontSize: "1rem", fontWeight: 700, color: colors.neutral[900], margin: "0 0 1rem" }}>
        Serial Number Lookup
      </h3>
      <p style={{ fontSize: "0.875rem", color: colors.neutral[500], margin: "0 0 1rem" }}>
        Enter any credit serial number to see its complete history — from issuance to retirement.
      </p>

      <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <input
          type="text"
          placeholder="e.g. 1042"
          value={serial}
          onChange={e => setSerial(e.target.value)}
          style={{
            flex: 1,
            border: `1px solid ${colors.neutral[300]}`,
            borderRadius: "0.5rem",
            padding: "0.6rem 1rem",
            fontSize: "0.875rem",
            fontFamily: "monospace",
          }}
        />
        <button
          type="submit"
          style={{
            background: colors.primary[600],
            color: "#fff",
            border: "none",
            borderRadius: "0.5rem",
            padding: "0.6rem 1.25rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Look Up
        </button>
      </form>

      {isLoading && <p style={{ color: colors.neutral[400], fontSize: "0.875rem" }}>Searching…</p>}
      {error && <p style={{ color: "#dc2626", fontSize: "0.875rem" }}>Serial number not found.</p>}

      {data && (
        <div style={{
          background: colors.primary[50],
          border: `1px solid ${colors.primary[200]}`,
          borderRadius: "0.5rem",
          padding: "1rem",
        }}>
          {"retirementId" in data ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "1.25rem" }}>🔒</span>
                <span style={{ fontWeight: 700, color: colors.primary[800] }}>Permanently Retired</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                {[
                  ["Retirement ID", (data as any).retirementId],
                  ["Beneficiary",   (data as any).beneficiary],
                  ["Project",       (data as any).projectId],
                  ["Vintage Year",  (data as any).vintageYear],
                  ["Retired At",    new Date((data as any).retiredAt).toLocaleDateString()],
                  ["Tx Hash",       (data as any).txHash?.slice(0, 20) + "…"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p style={{ fontSize: "0.7rem", color: colors.neutral[500], margin: "0 0 0.1rem" }}>{label}</p>
                    <p style={{ fontSize: "0.85rem", fontWeight: 600, color: colors.neutral[800], margin: 0, wordBreak: "break-all" }}>{value}</p>
                  </div>
                ))}
              </div>
              <a
                href={`/retire/${(data as any).retirementId}`}
                style={{ display: "inline-block", marginTop: "0.75rem", fontSize: "0.8rem", color: colors.primary[600], fontWeight: 600 }}
              >
                View Full Certificate →
              </a>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "1.25rem" }}>🌱</span>
                <span style={{ fontWeight: 700, color: colors.primary[800] }}>Active Credit</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                {[
                  ["Batch ID",     (data as any).batchId],
                  ["Project",      (data as any).projectId],
                  ["Vintage Year", (data as any).vintageYear],
                  ["Status",       (data as any).status],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p style={{ fontSize: "0.7rem", color: colors.neutral[500], margin: "0 0 0.1rem" }}>{label}</p>
                    <p style={{ fontSize: "0.85rem", fontWeight: 600, color: colors.neutral[800], margin: 0 }}>{value}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
