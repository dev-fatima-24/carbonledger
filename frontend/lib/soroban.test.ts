jest.mock("@stellar/stellar-sdk");

process.env.NEXT_PUBLIC_SOROBAN_RPC_URL = "https://soroban.example";
process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";

import * as soroban from "./soroban";

describe("lib/soroban", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it("simulates a contract call and returns the response", async () => {
    const server = soroban.sorobanServer as any;
    server.getAccount.mockResolvedValue({ accountId: "GACC" });
    server.simulateTransaction.mockResolvedValue({ foo: "bar" });

    const result = await soroban.simulateContract({
      contractId: "C0NTRACT",
      method: "methodName",
      args: [],
      sourcePublicKey: "GACC",
    });

    expect(result).toEqual({ foo: "bar" });
    expect(server.getAccount).toHaveBeenCalledWith("GACC");
    expect(server.simulateTransaction).toHaveBeenCalled();
  });

  it("invokes a contract and returns the transaction hash when confirmation succeeds", async () => {
    const server = soroban.sorobanServer as any;
    server.sendTransaction.mockResolvedValue({ status: "SUCCESS", hash: "hash-123" });
    server.getTransaction.mockResolvedValue({ status: "SUCCESS" });

    jest.useFakeTimers();
    const promise = soroban.invokeContract({
      contractId: "C0NTRACT",
      method: "methodName",
      args: [],
      sourcePublicKey: "GACC",
    }, "signed-xdr");

    await jest.advanceTimersByTimeAsync(3000);
    const result = await promise;

    expect(result).toBe("hash-123");
    expect(server.sendTransaction).toHaveBeenCalled();
    expect(server.getTransaction).toHaveBeenCalledWith("hash-123");
  });

  it("throws when sendTransaction returns an ERROR status", async () => {
    const server = soroban.sorobanServer as any;
    server.sendTransaction.mockResolvedValue({ status: "ERROR", errorResult: "bad" });

    await expect(
      soroban.invokeContract({
        contractId: "C0NTRACT",
        method: "methodName",
        args: [],
        sourcePublicKey: "GACC",
      }, "signed-xdr"),
    ).rejects.toThrow("Contract invocation failed: bad");
  });

  it("throws when transaction fails on chain", async () => {
    const server = soroban.sorobanServer as any;
    server.sendTransaction.mockResolvedValue({ status: "SUCCESS", hash: "hash-123" });
    server.getTransaction.mockResolvedValue({ status: "FAILED" });

    jest.useFakeTimers();
    const promise = soroban.invokeContract({
      contractId: "C0NTRACT",
      method: "methodName",
      args: [],
      sourcePublicKey: "GACC",
    }, "signed-xdr");

    const assertion = expect(promise).rejects.toThrow("Transaction failed on-chain");
    await jest.advanceTimersByTimeAsync(3000);
    await assertion;
  });

  it("returns contract events from the Soroban server", async () => {
    const server = soroban.sorobanServer as any;
    server.getEvents.mockResolvedValue({ events: [{ id: 1 }] });

    const events = await soroban.getContractEvents("C0NTRACT", 100);
    expect(events).toEqual([{ id: 1 }]);
    expect(server.getEvents).toHaveBeenCalledWith({
      startLedger: 100,
      filters: [{ type: "contract", contractIds: ["C0NTRACT"] }],
    });
  });

  it("parses scVal objects for carbon credit, retirement certificate, and market listing", () => {
    const sample = { foo: "bar" } as any;
    expect(soroban.parseCarbonCredit(sample)).toBe(sample);
    expect(soroban.parseRetirementCertificate(sample)).toBe(sample);
    expect(soroban.parseMarketListing(sample)).toBe(sample);
  });
});
