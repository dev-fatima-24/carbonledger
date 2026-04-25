"use client";

import { useProjects, useRetirements, useListings, useOracleStatus } from "../../lib/api";
import { formatTonnes } from "../../lib/carbon-utils";
import { colors, statusBadge } from "../../styles/design-system";
import OracleStatus from "../../components/OracleStatus";

const STALE_WARNING_DAYS = 60;
const STALE_TOTAL_DAYS = 365;

// Renders an amber alert banner when a project's monitoring is near the 365-day staleness limit.
function ProjectStaleAlert({ projectId, projectName }: { projectId: string; projectName: string }) {
  const { data } = useOracleStatus(projectId);
  if (!data?.lastSubmittedAt || !data.isCurrent) return null;

  const daysSince = Math.floor((Date.now() - new Date(data.lastSubmittedAt).getTime()) / 86_400_000);
  const daysUntilStale = STALE_TOTAL_DAYS - daysSince;
  if (daysUntilStale > STALE_WARNING_DAYS) return null;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "0.75rem",
      background: "#FEF3C7",
      border: "1px solid #FDE68A",
      borderRadius: "0.5rem",
      padding: "0.75rem 1rem",
      fontSize: "0.875rem",
      color: "#92400E",
    }}>
      <span style={{ fontSize: "1rem" }}>⚠</span>
      <span>
        <strong>{projectName}</strong> monitoring expires in{" "}
        <strong>{daysUntilStale} day{daysUntilStale === 1 ? "" : "s"}</strong> — submit new satellite data before the
        365-day limit or credits will be flagged as unverified.
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const { data: projects }    = useProjects();
  const { data: retirements } = useRetirements(50);
  const { data: listings }    = useListings();

  const totalIssued    = (projects ?? []).reduce((s, p) => s + p.totalCreditsIssued, 0);
  const totalRetired   = (projects ?? []).reduce((s, p) => s + p.totalCreditsRetired, 0);
  const activeCredits  = totalIssued - totalRetired;
  const activeListings = (listings ?? []).filter(l => l.status === "Active").length;

  const projectIds = new Set((projects ?? []).map(p => p.projectId));
  const earnings = (retirements ?? [])
    .filter(r => projectIds.has(r.projectId))
    .slice(0, 10);

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2.5rem 2rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 800, color: colors.neutral[900], margin: "0 0 2rem" }}>
        Project Developer Dashboard
      </h1>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1.25rem", marginBottom: "2rem" }}>
        {[
          { label: "Total Issued",     value: formatTonnes(totalIssued),   icon: "🌱" },
          { label: "Total Retired",    value: formatTonnes(totalRetired),  icon: "🔒" },
          { label: "Active Credits",   value: formatTonnes(activeCredits), icon: "✅" },
          { label: "Active Listings",  value: String(activeListings),      icon: "🏪" },
          { label: "Projects",         value: String(projects?.length ?? 0), icon: "🌍" },
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

      {/* Oracle staleness alerts */}
      {(projects ?? []).length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "2rem" }}>
          {(projects ?? []).map(p => (
            <ProjectStaleAlert key={p.projectId} projectId={p.projectId} projectName={p.name} />
          ))}
        </div>
      )}

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

      {/* Recent earnings */}
      <div style={{
        background: colors.surface, border: `1px solid ${colors.neutral[200]}`,
        borderRadius: "0.75rem", overflow: "hidden",
      }}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${colors.neutral[100]}` }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: colors.neutral[900], margin: 0 }}>
            Recent Earnings
          </h2>
          <p style={{ fontSize: "0.75rem", color: colors.neutral[500], margin: "0.25rem 0 0" }}>
            On-chain retirements of your project credits
          </p>
        </div>
        {earnings.length === 0 ? (
          <div style={{ padding: "2rem 1.5rem", textAlign: "center", color: colors.neutral[400], fontSize: "0.875rem" }}>
            No retirements recorded yet
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: colors.neutral[50] }}>
                {["Project", "Amount", "Vintage", "Beneficiary", "Date", "Transaction"].map(h => (
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
              {earnings.map(r => (
                <tr key={r.retirementId} style={{ borderTop: `1px solid ${colors.neutral[100]}` }}>
                  <td style={{ padding: "0.875rem 1.5rem", fontSize: "0.875rem", fontWeight: 600, color: colors.neutral[900] }}>
                    {r.projectName ?? r.projectId}
                  </td>
                  <td style={{ padding: "0.875rem 1.5rem", fontWeight: 600, color: colors.primary[700] }}>
                    {formatTonnes(r.amount)}
                  </td>
                  <td style={{ padding: "0.875rem 1.5rem", fontSize: "0.875rem", color: colors.neutral[700] }}>
                    {r.vintageYear}
                  </td>
                  <td style={{ padding: "0.875rem 1.5rem", fontSize: "0.875rem", color: colors.neutral[700], maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.beneficiary}
                  </td>
                  <td style={{ padding: "0.875rem 1.5rem", fontSize: "0.875rem", color: colors.neutral[500] }}>
                    {new Date(r.retiredAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "0.875rem 1.5rem" }}>
                    {r.txHash ? (
                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${r.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontFamily: "monospace", fontSize: "0.8rem", color: colors.primary[600], textDecoration: "none" }}
                      >
                        {r.txHash.slice(0, 8)}…
                      </a>
                    ) : (
                      <span style={{ fontSize: "0.8rem", color: colors.neutral[400] }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
