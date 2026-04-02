"use client";

import { useRetirements } from "../../lib/api";
import { formatTonnes } from "../../lib/carbon-utils";
import { colors } from "../../styles/design-system";
import AuditExplorer from "../../components/AuditExplorer";
import SerialNumberLookup from "../../components/SerialNumberLookup";

export default function AuditPage() {
  const { data: retirements } = useRetirements(5);

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2.5rem 2rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <div style={{
          display: "inline-block",
          background: colors.primary[50], color: colors.primary[700],
          border: `1px solid ${colors.primary[200]}`,
          borderRadius: "9999px", padding: "0.3rem 1rem",
          fontSize: "0.8rem", fontWeight: 600, marginBottom: "1rem",
        }}>
          No wallet required · Fully public
        </div>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, color: colors.neutral[900], margin: "0 0 0.5rem" }}>
          Public Audit Trail
        </h1>
        <p style={{ color: colors.neutral[500], margin: 0 }}>
          Every issuance, transfer, and retirement is permanently recorded on Stellar.
          Search any serial number or project to see complete provenance.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "2rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{
            background: colors.surface, border: `1px solid ${colors.neutral[200]}`,
            borderRadius: "0.75rem", padding: "1.5rem",
          }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: colors.neutral[900], margin: "0 0 1rem" }}>
              All Retirements
            </h2>
            <AuditExplorer />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <SerialNumberLookup />

          {/* Recent retirements summary */}
          <div style={{
            background: colors.surface, border: `1px solid ${colors.neutral[200]}`,
            borderRadius: "0.75rem", padding: "1.25rem",
          }}>
            <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: colors.neutral[800], margin: "0 0 0.75rem" }}>
              Recent Retirements
            </h3>
            {(retirements ?? []).map(r => (
              <div key={r.retirementId} style={{
                padding: "0.6rem 0", borderBottom: `1px solid ${colors.neutral[100]}`,
                display: "flex", justifyContent: "space-between",
              }}>
                <div>
                  <p style={{ fontSize: "0.8rem", fontWeight: 600, color: colors.neutral[800], margin: 0 }}>
                    {r.beneficiary}
                  </p>
                  <p style={{ fontSize: "0.7rem", color: colors.neutral[400], margin: "0.1rem 0 0" }}>
                    {r.projectId}
                  </p>
                </div>
                <a href={`/retire/${r.retirementId}`} style={{
                  fontSize: "0.75rem", fontWeight: 700, color: colors.primary[700],
                  textDecoration: "none", alignSelf: "center",
                }}>
                  {formatTonnes(r.amount)}
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
