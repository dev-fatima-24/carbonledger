export type WalletErrorCode =
  | "WALLET_NOT_INSTALLED"
  | "WALLET_PERMISSION_DENIED"
  | "WRONG_NETWORK"
  | "TRANSACTION_REJECTED"
  | "INSUFFICIENT_XLM"
  | "ACCOUNT_NOT_ACTIVATED"
  | "UNKNOWN";

const messages: Record<WalletErrorCode, string> = {
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
  UNKNOWN:
    "An unexpected error occurred. Please try again.",
};

export function getWalletErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    const code = error as WalletErrorCode;
    return messages[code] ?? messages.UNKNOWN;
  }
  if (error instanceof Error) {
    const code = error.message as WalletErrorCode;
    return messages[code] ?? error.message;
  }
  return messages.UNKNOWN;
}

export function isWalletError(error: unknown, code: WalletErrorCode): boolean {
  if (typeof error === "string") return error === code;
  if (error instanceof Error) return error.message === code;
  return false;
}
