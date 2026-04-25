jest.mock("@stellar/stellar-sdk");

process.env.NEXT_PUBLIC_HORIZON_URL = "https://horizon.example";
process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";

import * as stellar from "./stellar";
import { Horizon } from "@stellar/stellar-sdk";

describe("lib/stellar", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch as any;
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  it("creates a new Stellar keypair", async () => {
    const keypair = await stellar.createStellarAccount();
    expect(keypair.publicKey()).toBe("GTESTKEY");
    expect(keypair.secret()).toBe("STESTKEY");
  });

  it("funds a testnet account when friendbot responds ok", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await expect(stellar.fundTestnetAccount("GTESTKEY")).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledWith("https://friendbot.stellar.org?addr=GTESTKEY");
  });

  it("throws when friendbot funding fails", async () => {
    mockFetch.mockResolvedValue({ ok: false });
    await expect(stellar.fundTestnetAccount("GTESTKEY")).rejects.toThrow("Friendbot funding failed");
  });

  it("submits a transaction by XDR through the Horizon server", async () => {
    const server = stellar.horizonServer as any;
    server.submitTransaction.mockResolvedValue({ hash: "tx-hash" });

    const result = await stellar.submitTransaction("dummy-xdr");
    expect(result).toEqual({ hash: "tx-hash" });
    expect(server.submitTransaction).toHaveBeenCalledWith({ xdr: "dummy-xdr", network: "Testnet" });
  });

  it("loads account balances from Horizon server", async () => {
    const server = stellar.horizonServer as any;
    server.loadAccount.mockResolvedValue({ balances: [{ asset_type: "native", balance: "100" }] });

    const balances = await stellar.getAccountBalances("GTESTKEY");
    expect(balances).toEqual([{ asset_type: "native", balance: "100" }]);
  });

  it("formats and parses stroops correctly", () => {
    expect(stellar.formatStroops(BigInt(123456789))).toBe("12.3456789");
    expect(stellar.formatStroops("10000000")).toBe("1");
    expect(stellar.parseStroops("1.2345")).toBe(BigInt(12345000));
    expect(stellar.parseStroops("2")).toBe(BigInt(20000000));
  });

  it("issues an asset and returns the transaction hash", async () => {
    const server = stellar.horizonServer as any;
    server.loadAccount.mockResolvedValue({});
    server.submitTransaction.mockResolvedValue({ hash: "issue-hash" });

    const hash = await stellar.issueAsset({ publicKey: () => "GISSUER" } as any, "ABC", "GDIST", "100.0000000");
    expect(hash).toBe("issue-hash");
    expect(server.loadAccount).toHaveBeenCalledWith("GISSUER");
    expect(server.submitTransaction).toHaveBeenCalled();
  });

  it("creates a trustline and returns the transaction hash", async () => {
    const server = stellar.horizonServer as any;
    server.loadAccount.mockResolvedValue({});
    server.submitTransaction.mockResolvedValue({ hash: "trust-hash" });

    const hash = await stellar.createTrustline({ publicKey: () => "GACC" } as any, "ABC", "GISSUER");
    expect(hash).toBe("trust-hash");
    expect(server.loadAccount).toHaveBeenCalledWith("GACC");
    expect(server.submitTransaction).toHaveBeenCalled();
  });
});
