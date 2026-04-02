"use client";

import { useOracleStatus } from "../lib/api";
import { colors } from "../styles/design-system";

interface Props {
  projectId: string;
}

export default function OracleStatus({ projectId }: Props) {
  const { data, isLoading } = useOracleStatus(projectId);

  if (isLoading) return (
    <div style={{ padding: "0.75rem", background: colors.neutral[50], borderRadius: "0.5rem", fontSize: "0.8rem", color: colors.neutral[400] }}>
      Checking oracle status…
    </div>
  );

  const isCurrent = data?.isCurrent ?? false;
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
      alignItems: "center",
      gap: "0.75rem",
    }}>
      <span style={{ fontSize: "1.1rem" }}>{isCurrent ? "🛰️" : "⚠️"}</span>
      <div>
        <p style={{ fontWeight: 600, fontSize: "0.8rem", color: text, margin: 0 }}>
          {isCurrent ? "Monitoring Current" : "Monitoring Data Stale"}
        </p>
        {data?.lastSubmittedAt && (
          <p style={{ fontSize: "0.7rem", color: text, margin: "0.1rem 0 0", opacity: 0.8 }}>
            Last update: {new Date(data.lastSubmittedAt).toLocaleDateString()}
            {data.latestScore !== null && ` · Score: ${data.latestScore}/100`}
          </p>
        )}
        {!data?.lastSubmittedAt && (
          <p style={{ fontSize: "0.7rem", color: text, margin: "0.1rem 0 0", opacity: 0.8 }}>
            No monitoring data submitted yet
          </p>
        )}
      </div>
    </div>
  );
}
