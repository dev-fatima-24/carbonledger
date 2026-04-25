"use client";

import { useOracleStatus } from "../lib/api";
import { colors } from "../styles/design-system";

interface Props {
  projectId: string;
}

const STALE_DAYS = 365;
const WARNING_THRESHOLD_DAYS = 60;

export default function OracleStatus({ projectId }: Props) {
  const { data, isLoading } = useOracleStatus(projectId);

  if (isLoading) return (
    <div style={{ padding: "0.75rem", background: colors.neutral[50], borderRadius: "0.5rem", fontSize: "0.8rem", color: colors.neutral[400] }}>
      Checking oracle status…
    </div>
  );

  const isCurrent = data?.isCurrent ?? false;

  let daysSince: number | null = null;
  let daysUntilStale: number | null = null;
  if (data?.lastSubmittedAt) {
    daysSince = Math.floor((Date.now() - new Date(data.lastSubmittedAt).getTime()) / 86_400_000);
    daysUntilStale = STALE_DAYS - daysSince;
  }

  const isExpiringSoon = isCurrent && daysUntilStale !== null && daysUntilStale <= WARNING_THRESHOLD_DAYS;

  const bg     = isCurrent ? colors.verified.bg     : colors.suspended.bg;
  const text   = isCurrent ? colors.verified.text   : colors.suspended.text;
  const border = isCurrent ? colors.verified.border : colors.suspended.border;

  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: "0.5rem",
      padding: "0.75rem 1rem",
      display: "flex",
      alignItems: "flex-start",
      gap: "0.75rem",
    }}>
      <span style={{ fontSize: "1.1rem", marginTop: "0.05rem" }}>{isCurrent ? "🛰️" : "⚠️"}</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 600, fontSize: "0.8rem", color: text, margin: 0 }}>
          {isCurrent ? "Monitoring Current" : "Monitoring Data Stale"}
        </p>
        {daysSince !== null ? (
          <p style={{ fontSize: "0.7rem", color: text, margin: "0.1rem 0 0", opacity: 0.8 }}>
            Last update: {daysSince === 0 ? "today" : `${daysSince} day${daysSince === 1 ? "" : "s"} ago`}
            {data?.latestScore !== null && ` · Score: ${data.latestScore}/100`}
          </p>
        ) : (
          <p style={{ fontSize: "0.7rem", color: text, margin: "0.1rem 0 0", opacity: 0.8 }}>
            No monitoring data submitted yet
          </p>
        )}
        {isExpiringSoon && daysUntilStale !== null && (
          <span style={{
            display: "inline-block",
            marginTop: "0.35rem",
            background: "#FEF3C7",
            color: "#92400E",
            border: "1px solid #FDE68A",
            borderRadius: "9999px",
            padding: "0.1rem 0.5rem",
            fontSize: "0.65rem",
            fontWeight: 700,
          }}>
            Expires in {daysUntilStale} day{daysUntilStale === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}
