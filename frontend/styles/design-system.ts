// Design system tokens for CarbonLedger
// Professional corporate green palette — buyers are sustainability officers and CFOs

export const colors = {
  // Primary greens
  primary: {
    50:  "#f0fdf4",
    100: "#dcfce7",
    200: "#bbf7d0",
    300: "#86efac",
    400: "#4ade80",
    500: "#22c55e",
    600: "#16a34a",
    700: "#15803d",
    800: "#166534",
    900: "#14532d",
    950: "#052e16",
  },
  // Neutral grays
  neutral: {
    50:  "#f9fafb",
    100: "#f3f4f6",
    200: "#e5e7eb",
    300: "#d1d5db",
    400: "#9ca3af",
    500: "#6b7280",
    600: "#4b5563",
    700: "#374151",
    800: "#1f2937",
    900: "#111827",
    950: "#030712",
  },
  // Semantic
  verified:  { bg: "#dcfce7", text: "#15803d", border: "#86efac" },
  pending:   { bg: "#fef9c3", text: "#854d0e", border: "#fde047" },
  suspended: { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" },
  rejected:  { bg: "#fce7f3", text: "#9d174d", border: "#f9a8d4" },
  completed: { bg: "#ede9fe", text: "#5b21b6", border: "#c4b5fd" },
  // USDC blue
  usdc: "#2775CA",
  // White / surface
  surface: "#ffffff",
  surfaceAlt: "#f9fafb",
} as const;

export const typography = {
  fontFamily: {
    sans:  "'Inter', 'Helvetica Neue', Arial, sans-serif",
    mono:  "'JetBrains Mono', 'Fira Code', monospace",
  },
  fontSize: {
    xs:   "0.75rem",
    sm:   "0.875rem",
    base: "1rem",
    lg:   "1.125rem",
    xl:   "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
    "5xl": "3rem",
  },
  fontWeight: {
    normal:   400,
    medium:   500,
    semibold: 600,
    bold:     700,
  },
} as const;

export const spacing = {
  0:  "0",
  1:  "0.25rem",
  2:  "0.5rem",
  3:  "0.75rem",
  4:  "1rem",
  5:  "1.25rem",
  6:  "1.5rem",
  8:  "2rem",
  10: "2.5rem",
  12: "3rem",
  16: "4rem",
  20: "5rem",
  24: "6rem",
} as const;

export const borderRadius = {
  sm:   "0.25rem",
  md:   "0.375rem",
  lg:   "0.5rem",
  xl:   "0.75rem",
  "2xl": "1rem",
  full: "9999px",
} as const;

export const shadows = {
  sm:  "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  md:  "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg:  "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  xl:  "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  certificate: "0 25px 50px -12px rgb(0 0 0 / 0.25)",
} as const;

export const statusBadge = (status: string) => {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    Verified:  colors.verified,
    Pending:   colors.pending,
    Suspended: colors.suspended,
    Rejected:  colors.rejected,
    Completed: colors.completed,
    Active:    colors.verified,
    Sold:      colors.completed,
    Delisted:  colors.suspended,
  };
  return map[status] ?? colors.pending;
};
