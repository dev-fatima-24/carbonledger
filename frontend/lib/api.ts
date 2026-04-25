import useSWR, { SWRConfiguration } from "swr";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CarbonProject {
  id: string;
  projectId: string;
  name: string;
  methodology: string;
  country: string;
  projectType: string;
  status: string;
  vintageYear: number;
  methodologyScore: number;
  totalCreditsIssued: number;
  totalCreditsRetired: number;
  metadataCid: string;
  methodologyScore: number;
  createdAt: string;
}

export interface CreditBatch {
  id: string;
  batchId: string;
  projectId: string;
  vintageYear: number;
  amount: number;
  serialStart: string;
  serialEnd: string;
  status: string;
  metadataCid: string;
  issuedAt: string;
}

export interface MarketListing {
  id: string;
  listingId: string;
  projectId: string;
  projectName: string;
  batchId: string;
  seller: string;
  amountAvailable: number;
  pricePerCredit: string;
  vintageYear: number;
  methodology: string;
  country: string;
  status: string;
  createdAt: string;
}

export interface RetirementRecord {
  id: string;
  retirementId: string;
  batchId: string;
  projectId: string;
  projectName: string;
  amount: number;
  retiredBy: string;
  beneficiary: string;
  retirementReason: string;
  vintageYear: number;
  serialNumbers: string[];
  retiredAt: string;
  txHash: string;
}

export interface OracleStatus {
  projectId: string;
  lastSubmittedAt: string | null;
  isCurrent: boolean;
  latestScore: number | null;
}

export interface PlatformStats {
  totalCreditsIssued: number;
  totalCreditsRetired: number;
  activeProjects: number;
  marketplaceVolume: string;
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || "API error");
  }
  return res.json();
}

const swrConfig: SWRConfiguration = {
  revalidateOnFocus: true,
  errorRetryCount: 3,
  dedupingInterval: 5000,
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useProjects(params?: { methodology?: string; country?: string; vintage?: number }) {
  const query = new URLSearchParams(params as Record<string, string>).toString();
  return useSWR<CarbonProject[]>(`${API_URL}/projects?${query}`, fetcher, swrConfig);
}

export function useProject(id: string) {
  return useSWR<CarbonProject>(id ? `${API_URL}/projects/${id}` : null, fetcher, swrConfig);
}

export function useListings(params?: { methodology?: string; vintage?: number; country?: string; minPrice?: string; maxPrice?: string }) {
  const query = new URLSearchParams(params as Record<string, string>).toString();
  return useSWR<MarketListing[]>(`${API_URL}/marketplace/listings?${query}`, fetcher, swrConfig);
}

export function useListing(id: string) {
  return useSWR<MarketListing>(id ? `${API_URL}/marketplace/listings/${id}` : null, fetcher, swrConfig);
}

export function useRetirements(limit = 20) {
  return useSWR<RetirementRecord[]>(`${API_URL}/retirements?limit=${limit}`, fetcher, swrConfig);
}

export function useRetirement(id: string) {
  return useSWR<RetirementRecord>(id ? `${API_URL}/retirements/${id}` : null, fetcher, swrConfig);
}

export function useOracleStatus(projectId: string) {
  return useSWR<OracleStatus>(
    projectId ? `${API_URL}/oracle/status/${projectId}` : null,
    fetcher,
    { ...swrConfig, refreshInterval: 60_000 },
  );
}

export function usePlatformStats() {
  return useSWR<PlatformStats>(`${API_URL}/stats`, fetcher, {
    ...swrConfig,
    refreshInterval: 30_000,
  });
}

export function useSerialLookup(serial: string) {
  return useSWR<RetirementRecord | CreditBatch>(
    serial ? `${API_URL}/credits/lookup/${serial}` : null,
    fetcher,
    swrConfig,
  );
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function purchaseCredits(listingId: string, amount: number, buyerPublicKey: string) {
  const res = await fetch(`${API_URL}/marketplace/purchase`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listingId, amount, buyerPublicKey }),
  });
  if (!res.ok) throw new Error((await res.json()).message);
  return res.json();
}

export async function retireCredits(payload: {
  batchId: string;
  amount: number;
  beneficiary: string;
  retirementReason: string;
  holderPublicKey: string;
}) {
  const res = await fetch(`${API_URL}/credits/retire`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.json()).message);
  return res.json();
}

export async function generateCertificatePdf(retirementId: string): Promise<Blob> {
  const res = await fetch(`${API_URL}/retirements/generate-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ retirementId }),
  });
  if (!res.ok) throw new Error("PDF generation failed");
  return res.blob();
}
