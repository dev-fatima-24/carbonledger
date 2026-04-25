import { getWalletErrorMessage, isWalletError } from "./wallet-errors";

describe("lib/wallet-errors", () => {
  const expectedMessages = {
    WALLET_NOT_INSTALLED:
      "Freighter wallet is not installed. Please install it from freighter.app to continue.",
    WALLET_PERMISSION_DENIED:
      "Permission denied. Please allow CarbonLedger to connect to your Freighter wallet.",
    WRONG_NETWORK:
      "Your wallet is connected to the wrong network. Please switch to Stellar Testnet in Freighter.",
    TRANSACTION_REJECTED:
      "Transaction was rejected. Please try again or contact support if the issue persists.",
    INSUFFICIENT_XLM:
      "Insufficient XLM balance to cover transaction fees. Please add XLM to your account.",
    ACCOUNT_NOT_ACTIVATED:
      "Your Stellar account is not activated. You need a minimum of 1 XLM to activate it.",
    UNKNOWN: "An unexpected error occurred. Please try again.",
  } as const;

  it("returns human-readable messages for all known wallet error codes", () => {
    for (const [code, message] of Object.entries(expectedMessages)) {
      expect(getWalletErrorMessage(code)).toBe(message);
    }
  });

  it("falls back to the original message for unknown Error objects", () => {
    expect(getWalletErrorMessage(new Error("SOME_OTHER_ERROR"))).toBe("SOME_OTHER_ERROR");
  });

  it("returns unknown message for unknown string codes", () => {
    expect(getWalletErrorMessage("NOT_A_CODE")).toBe(expectedMessages.UNKNOWN);
  });

  it("detects wallet errors by code string", () => {
    expect(isWalletError("WRONG_NETWORK", "WRONG_NETWORK")).toBe(true);
    expect(isWalletError("WRONG_NETWORK", "ACCOUNT_NOT_ACTIVATED")).toBe(false);
  });

  it("detects wallet errors by Error object message", () => {
    expect(isWalletError(new Error("TRANSACTION_REJECTED"), "TRANSACTION_REJECTED")).toBe(true);
    expect(isWalletError(new Error("TRANSACTION_REJECTED"), "WRONG_NETWORK")).toBe(false);
  });
});
