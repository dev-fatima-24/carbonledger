"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { retireCredits } from "../../lib/api";
import { formatTonnes } from "../../lib/carbon-utils";
import { connectFreighter } from "../../lib/freighter";
import { getWalletErrorMessage } from "../../lib/wallet-errors";
import { colors } from "../../styles/design-system";
import TransactionStatus, { TxStatus } from "../../components/TransactionStatus";
import Toast, { useToast } from "../../components/Toast";
import { useWalletStatus } from "../../hooks/useWalletStatus";
import WalletPrompt from "../../components/WalletPrompt";

export default function RetirePage() {
  const searchParams = useSearchParams();
  const batchId      = searchParams.get("batch") ?? "";

  const [amount, setAmount]         = useState(1);
  const [beneficiary, setBeneficiary] = useState("");
  const [reason, setReason]         = useState("");
  const [txStatus, setTxStatus]     = useState<TxStatus | null>(null);
  const [txHash, setTxHash]         = useState<string | null>(null);
  const [retirementId, setRetirementId] = useState<string | null>(null);
  const { toasts, addToast, dismiss } = useToast();
  const { status: walletStatus, address: walletKey, refresh: refreshWallet } = useWalletStatus();

  async function handleConnect(key: string) {
    addToast({ type: "success", title: "Wallet connected", message: key.slice(0, 8) + "…" });
  }

  async function handleRetire() {
    if (!walletKey || !batchId || !beneficiary || !reason) return;
    setTxStatus("pending");
    try {
      setTxStatus("submitted");
      const result = await retireCredits({
        batchId,
        amount,
        beneficiary,
        retirementReason: reason,
        holderPublicKey: walletKey,
      });
      setTxHash(result.txHash);
      setRetirementId(result.retirementId);
      setTxStatus("confirmed");
      addToast({
        type: "success",
        title: "Credits permanently retired",
        message: `${formatTonnes(amount)} retired on behalf of ${beneficiary}`,
        txHash: result.txHash,
      });
    } catch (e: any) {
      setTxStatus("failed");
      addToast({ type: "error", title: "Retirement failed", message: e.message });
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", border: `1px solid ${colors.neutral[300]}`,
    borderRadius: "0.5rem", padding: "0.75rem 1rem",
    fontSize: "0.9rem", color: colors.neutral[900],
    boxSizing: "border-box",
  };

  const isDisabled = !beneficiary || !reason || txStatus === "submitted" || txStatus === "confirmed";

  return (
    <ErrorBoundary>
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "2.5rem 2rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 800, color: colors.neutral[900], margin: "0 0 0.5rem" }}>
        Retire Carbon Credits
      </h1>
      <p style={{ color: colors.neutral[500], margin: "0 0 2rem" }}>
        Retirement is permanent and irreversible. A verifiable certificate will be issued for ESG reporting.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div>
          <label style={{ fontSize: "0.875rem", fontWeight: 600, color: colors.neutral[700], display: "block", marginBottom: "0.4rem" }}>
            Amount to Retire (tonnes CO₂e) — minimum 0.01 tCO₂e
          </label>
          <input
            type="number" min={0.01} step={0.01} value={amount}
            onChange={e => {
              const v = parseFloat(parseFloat(e.target.value).toFixed(2));
              setAmount(Math.max(0.01, v || 0.01));
            }}
            style={inputStyle}
          />
        </div>

        <div>
          <label htmlFor="retire-beneficiary" style={{ fontSize: "0.875rem", fontWeight: 600, color: colors.neutral[700], display: "block", marginBottom: "0.4rem" }}>
            Beneficiary Name (appears on certificate)
          </label>
          <input
            id="retire-beneficiary"
            type="text"
            placeholder="e.g. Acme Corporation"
            value={beneficiary}
            onChange={e => setBeneficiary(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label htmlFor="retire-reason" style={{ fontSize: "0.875rem", fontWeight: 600, color: colors.neutral[700], display: "block", marginBottom: "0.4rem" }}>
            Retirement Reason
          </label>
          <textarea
            id="retire-reason"
            placeholder="e.g. Offsetting 2023 Scope 1 and 2 emissions"
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>

        {/* Warning */}
        <div
          id="retire-warning"
          role="note"
          style={{
            background: "#fef9c3", border: "1px solid #fde047",
            borderRadius: "0.5rem", padding: "0.875rem 1rem",
            display: "flex", gap: "0.75rem",
          }}
        >
          <span aria-hidden="true">⚠️</span>
          <p style={{ fontSize: "0.8rem", color: "#854d0e", margin: 0 }}>
            Retirement is <strong>permanent and irreversible</strong>. Once retired, these credits cannot be transferred, resold, or retired again.
          </p>
        </div>

        {txStatus && <TransactionStatus status={txStatus} txHash={txHash ?? undefined} />}

        {retirementId && txStatus === "confirmed" && (
          <a
            href={`/retire/${retirementId}`}
            style={{
              display: "block", textAlign: "center",
              background: colors.primary[50], color: colors.primary[700],
              border: `1px solid ${colors.primary[200]}`,
              borderRadius: "0.5rem", padding: "0.875rem",
              fontSize: "0.9rem", fontWeight: 700, textDecoration: "none",
            }}
          >
            View & Download Certificate →
          </a>
        )}

        {walletStatus !== "ready" ? (
          <WalletPrompt status={walletStatus} onConnect={handleConnect} refresh={refreshWallet} />
        ) : (
          <button
            type="button"
            onClick={handleRetire}
            disabled={isDisabled}
            aria-disabled={isDisabled}
            aria-describedby="retire-warning"
            style={{
              background: isDisabled ? colors.neutral[300] : "#dc2626",
              color: "#fff", border: "none", borderRadius: "0.5rem",
              padding: "0.875rem", fontSize: "1rem", fontWeight: 700,
              cursor: isDisabled ? "not-allowed" : "pointer",
            }}
          >
            {txStatus === "pending"   ? "Preparing…"   :
             txStatus === "submitted" ? "Confirming…"  :
             txStatus === "confirmed" ? "Retired ✓"    :
             `Permanently Retire ${formatTonnes(amount)}`}
          </button>
        )}
      </div>

      <Toast toasts={toasts} onDismiss={dismiss} />
    </div>
    </ErrorBoundary>
  );
}
