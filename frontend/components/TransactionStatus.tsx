"use client";

import { colors } from "../styles/design-system";

export type TxStatus = "pending" | "submitted" | "confirmed" | "failed";

interface Props {
  status: TxStatus;
  txHash?: string;
  message?: string;
}

const config: Record<TxStatus, { icon: string; label: string; bg: string; text: string; border: string }> = {
  pending:   { icon: "⏳", label: "Preparing transaction…",    bg: "#eff6ff", text: "#1d4ed8", border: "#93c5fd" },
  submitted: { icon: "📡", label: "Transaction submitted",     bg: colors.pending.bg, text: colors.pending.text, border: colors.pending.border },
  confirmed: { icon: "✅", label: "Transaction confirmed",     bg: colors.verified.bg, text: colors.verified.text, border: colors.verified.border },
  failed:    { icon: "❌", label: "Transaction failed",        bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" },
};

export default function TransactionStatus({ status, txHash, message }: Props) {
  const cfg = config[status];

  return (
    <div style={{
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: "0.5rem",
      padding: "1rem 1.25rem",
      display: "flex",
      alignItems: "center",
      gap: "0.75rem",
    }}>
      <span style={{ fontSize: "1.25rem" }}>{cfg.icon}</span>
      <div>
        <p style={{ fontWeight: 700, fontSize: "0.875rem", color: cfg.text, margin: 0 }}>
          {cfg.label}
        </p>
        {message && (
          <p style={{ fontSize: "0.8rem", color: cfg.text, margin: "0.2rem 0 0", opacity: 0.8 }}>
            {message}
          </p>
        )}
        {txHash && (
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "0.75rem", color: cfg.text, fontFamily: "monospace", display: "block", marginTop: "0.25rem" }}
          >
            {txHash.slice(0, 24)}… — View on Stellar Explorer →
          </a>
        )}
      </div>
    </div>
  );
}
