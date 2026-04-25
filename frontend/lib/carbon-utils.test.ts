import {
  calculateCreditCost,
  formatTonnes,
  generateRetirementId,
  generateBatchId,
  validateSerialRange,
  formatVintageYear,
  calculateCO2Equivalent,
  formatUSDC,
} from "./carbon-utils";

describe("lib/carbon-utils", () => {
  it("calculates credit cost correctly", () => {
    expect(calculateCreditCost(3, BigInt(15))).toBe(BigInt(45));
  });

  it("formats tonne values correctly", () => {
    expect(formatTonnes(95)).toBe("95 tCO₂e");
    expect(formatTonnes(1_500)).toBe("1.5K tCO₂e");
    expect(formatTonnes(2_000_000)).toBe("2.00M tCO₂e");
  });

  it("generates deterministic retirement and batch IDs", () => {
    expect(generateRetirementId("batch-123", 1680000000)).toBe("ret-batch-123-1680000000");
    expect(generateBatchId("project-A", 2025, 7)).toBe("batch-project-A-2025-0007");
  });

  it("validates serial ranges correctly", () => {
    expect(validateSerialRange(BigInt(1), BigInt(1))).toBe(true);
    expect(validateSerialRange(BigInt(1), BigInt(5))).toBe(true);
    expect(validateSerialRange(BigInt(5), BigInt(1))).toBe(false);
    expect(validateSerialRange(BigInt(0), BigInt(1))).toBe(false);
  });

  it("formats vintage year correctly", () => {
    expect(formatVintageYear(2024)).toBe("2024 Vintage");
  });

  it("calculates CO2 equivalent metrics correctly", () => {
    const equivalents = calculateCO2Equivalent(9.2);
    expect(equivalents).toEqual({ cars: 2, flights: 36, homes: 1 });
  });

  it("formats USDC amounts from stroops", () => {
    expect(formatUSDC(BigInt(15000000))).toBe("$1.5 USDC");
    expect(formatUSDC("10000000")).toBe("$1 USDC");
  });
});
