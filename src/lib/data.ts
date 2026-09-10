import { fallbackDataset } from "../data/fallbackDataset";
import type { AsterDataset, LiquidityDataset, UpcomingEventsDataset } from "../types/liquidity";

export type LiquidityMarket = "usd" | "jpy" | "risk" | "treasury" | "capex" | "cost";

const dataFiles: Record<LiquidityMarket, string> = {
  usd: "liquidity.json",
  jpy: "yen-liquidity.json",
  risk: "risk-markets.json",
  treasury: "treasury-markets.json",
  capex: "capex.json",
  cost: "cost-of-capital.json"
};

function parseCleanJson<T>(raw: string): T {
  const cleaned = raw
    .replace(/&#x20;|&#32;|&nbsp;/gi, " ")
    .replace(/\u00a0/g, " ");
  return JSON.parse(cleaned) as T;
}

export async function loadLiquidityDataset(market: LiquidityMarket = "usd"): Promise<LiquidityDataset> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/${dataFiles[market]}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`data request failed: ${response.status}`);
    return parseCleanJson<LiquidityDataset>(await response.text());
  } catch (error) {
    console.warn("Using fallback liquidity dataset", error);
    return fallbackDataset;
  }
}

export async function loadUpcomingEvents(): Promise<UpcomingEventsDataset> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/upcoming-events.json`, { cache: "no-store" });
  if (!response.ok) throw new Error(`event data request failed: ${response.status}`);
  return parseCleanJson<UpcomingEventsDataset>(await response.text());
}

export async function loadAsterDataset(): Promise<AsterDataset> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/aster.json`, { cache: "no-store" });
  if (!response.ok) throw new Error(`ASTER data request failed: ${response.status}`);
  return parseCleanJson<AsterDataset>(await response.text());
}
