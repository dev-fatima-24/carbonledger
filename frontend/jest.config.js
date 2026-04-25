module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>"],
  testMatch: ["**/?(*.)+(spec|test).[jt]s?(x)"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: "tsconfig.json",
      diagnostics: false,
    }],
  },
  collectCoverage: true,
  collectCoverageFrom: [
    "lib/stellar.ts",
    "lib/soroban.ts",
    "lib/carbon-utils.ts",
    "lib/wallet-errors.ts",
  ],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
    "./lib/stellar.ts": { branches: 80, functions: 80, lines: 80, statements: 80 },
    "./lib/soroban.ts": { branches: 80, functions: 80, lines: 80, statements: 80 },
    "./lib/carbon-utils.ts": { branches: 80, functions: 80, lines: 80, statements: 80 },
    "./lib/wallet-errors.ts": { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};
