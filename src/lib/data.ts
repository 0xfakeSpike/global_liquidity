import { fallbackDataset } from "../data/fallbackDataset";
import type { LiquidityDataset } from "../types/liquidity";

export async function loadLiquidityDataset(): Promise<LiquidityDataset> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/liquidity.json`, { cache: "no-store" });
    if (!response.ok) throw new Error(`data request failed: ${response.status}`);
    return (await response.json()) as LiquidityDataset;
  } catch (error) {
    console.warn("Using fallback liquidity dataset", error);
    return fallbackDataset;
  }
}
