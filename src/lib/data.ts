import { fallbackDataset } from "../data/fallbackDataset";
import type { LiquidityDataset, UpcomingEventsDataset } from "../types/liquidity";

export type LiquidityMarket = "usd" | "jpy" | "risk" | "treasury";

const dataFiles: Record<LiquidityMarket, string> = {
  usd: "liquidity.json",
  jpy: "yen-liquidity.json",
  risk: "risk-markets.json",
  treasury: "treasury-markets.json"
};

export async function loadLiquidityDataset(market: LiquidityMarket = "usd"): Promise<LiquidityDataset> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/${dataFiles[market]}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`data request failed: ${response.status}`);
    return (await response.json()) as LiquidityDataset;
  } catch (error) {
    console.warn("Using fallback liquidity dataset", error);
    return fallbackDataset;
  }
}

export async function loadUpcomingEvents(): Promise<UpcomingEventsDataset> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/upcoming-events.json`, { cache: "no-store" });
  if (!response.ok) throw new Error(`event data request failed: ${response.status}`);
  return response.json() as Promise<UpcomingEventsDataset>;
}
