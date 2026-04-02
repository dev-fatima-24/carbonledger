"use client";

import { useProjects, useRetirements, useListings } from "../../lib/api";
import { formatTonnes, formatStroops } from "../../lib/carbon-utils";
import { colors, statusBadge } from "../../styles/design-system";
import OracleStatus from "../../components/OracleStatus";

export default function DashboardPage() {
  const { data: projects }   = useProjects();
  const { data: retirements } = useRetirements(20);
  const { data: listings }   = useListings();

  const totalIssued   = (projects ?? []).reduce((s, p) => s + p.totalCreditsIssued, 0);
  const totalRetired  = (projects ?? []).reduce((s, p) => s + p.totalCreditsRetired, 0);
  const activeListings = (listings ?? []).filter(l => l.status === "Active").length;

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2.5rem 2rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 800, color: colors.neutral[900], margin: "0 0 2rem" }}>
        Project Developer Dashboard
      </h1>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1.25rem", marginBottom: "2.5rem" }}>
        {[
          { label: "Total Issued",    value: formatTonnes(totalIssued),  icon: "🌱" },
          { label: "Total Retired",   value: formatTonnes(totalRetired), icon: "🔒" },
          { label: "Active Listings", value: String(activeListings),     icon: "🏪" },
          { label: "Projects",        value: String(projects?.length ?? 0), icon: "🌍" },
        ].map(({ label, value, icon }) => (
          <div key={label} style={{
            background: colors.surface, border: `1px solid ${colors.neutral[200]}`,
            borderRadius: "0.75rem", padding: "1.25rem",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: "0.75rem", color: colors.neutral[500], margin: "0 0 0.4rem" }}>{label}</p>
                <p style={{ fontSize: "1.5rem", fontWeight: 800, color: colors.neutral[900], margin: 0 }}>{value}</p>
              </div>
              <span style={{ fontSize: "1.75rem" }}>{icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Projects table */}
      <div style={{
        background: colors.surface, border: `1px solid ${colors.neutral[200]}`,
        borderRadius: "0.75rem", overflow: "hidden", marginBottom: "2rem",
      }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${colors.neutral[100]}` }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: colors.neutral[900], margin: 0 }}>
            Your Projects
          </h2>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: colors.neutral[50] }}>
              {["Project", "Methodology", "Issued", "Retired", "Status", "Oracle"].map(h => (
                <th key={h} style={{
                  padding: "0.75rem 1.5rem", textAlign: "left",
                  fontSize: "0.75rem", fontWeight: 600, color: colors.neutral[500],
                  textTransform: "uppercase", letterSpacing: "0.05em",
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(projects ?? []).map(p => {
              const badge = statusBadge(p.status);
              return (
                <tr key={p.projectId} style={{ borderTop: `1px solid ${colors.neutral[100]}` }}>
                  <td style={{ padding: "1rem 1.5rem" }}>
                    <a href={`/projects/${p.projectId}`} style={{ fontWeight: 600, color: colors.neutral[900], textDecoration: "none" }}>
                      {p.name}
                    </a>
                    <p style={{ fontSize: "0.75rem", color: colors.neutral[400], margin: "0.1rem 0 0" }}>{p.country}</p>
                  </td>
                  <td style={{ padding: "1rem 1.5rem", fontSize: "0.875rem", color: colors.neutral[700] }}>{p.methodology}</td>
                  <td style={{ padding: "1rem 1.5rem", fontWeight: 600, color: colors.primary[700] }}>{formatTonnes(p.totalCreditsIssued)}</td>
                  <td style={{ padding: "1rem 1.5rem", fontWeight: 600, color: colors.neutral[700] }}>{formatTonnes(p.totalCreditsRetired)}</td>
                  <td style={{ padding: "1rem 1.5rem" }}>
                    <span style={{
                      background: badge.bg, color: badge.text, border: `1px solid ${badge.border}`,
                      borderRadius: "9999px", padding: "0.2rem 0.6rem", fontSize: "0.7rem", fontWeight: 600,
                    }}>
                      {p.status}
                    </span>
                  </td>
                  <td style={{ padding: "1rem 1.5rem" }}>
                    <OracleStatus projectId={p.projectId} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
