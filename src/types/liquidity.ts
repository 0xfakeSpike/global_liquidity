export interface DataPoint {
  date: string;
  value: number;
}

export interface IndicatorDefinition {
  key: string;
  name: string;
  shortName: string;
  group: string;
  unit: string;
  source: string;
  sourceUrl: string;
  direction: "up_is_looser" | "up_is_tighter";
  weight: number;
  description: string;
  formula?: string;
}

export interface IndicatorSnapshot {
  key: string;
  latestDate: string;
  latestValue: number;
  previousValue: number | null;
  oneDayChange: number | null;
  oneMonthChange: number | null;
  percentile: number | null;
  zScore: number | null;
  scoreContribution: number | null;
  series: DataPoint[];
}

export interface InterestRateSeries {
  key: string;
  label: string;
  color: string;
  unit: string;
  source: string;
  sourceUrl: string;
  description: string;
  points: DataPoint[];
}

export interface InterestRateChart {
  title: string;
  description: string;
  series: InterestRateSeries[];
}

export interface HolderShare {
  key: string;
  label: string;
  value: number;
  unit: string;
  color: string;
  source: string;
  sourceUrl: string;
  date: string;
}

export interface UpcomingEvent {
  id: string;
  date: string;
  endDate?: string;
  region: "美国" | "日本";
  category: "议息会议" | "官员讲话" | "美债供给";
  importance: "high" | "medium";
  title: string;
  detail: string;
  source: string;
  sourceUrl: string;
}

export interface UpcomingEventsDataset {
  generatedAt: string;
  timezone: string;
  events: UpcomingEvent[];
  failures?: string[];
}

export interface AsterMetric {
  label: string;
  value: number;
  unit: "ASTER" | "%" | "USD";
  detail: string;
  source: string;
  sourceUrl: string;
}

export interface AsterUnlockEvent {
  date: string;
  amount: number;
  category: string;
  status: "scheduled" | "recurring" | "postponed";
  detail: string;
  sourceUrl: string;
}

export interface AsterBuybackEvent {
  startDate: string;
  endDate: string;
  bought: number;
  burned: number;
  detail: string;
  sourceUrl: string;
}

export interface AsterDataset {
  generatedAt: string;
  token: {
    name: string;
    symbol: string;
    chain: string;
    contract: string;
    maxSupply: number;
  };
  metrics: {
    circulating: AsterMetric;
    totalSupply: AsterMetric;
    circulatingRatio: AsterMetric;
    cumulativeBurn: AsterMetric;
    latestBuyback: AsterMetric;
  };
  unlocks: AsterUnlockEvent[];
  buybacks: AsterBuybackEvent[];
  allocation: { label: string; percent: number; amount: number; color: string }[];
  notes: string[];
}

export interface AiCapexCommitment {
  name: string;
  amount: string;
  horizon: string;
  type: string;
  announcedDate: string;
  sourceUrl: string;
  detail: string;
}

export interface AiCapexCompanyMetrics {
  key: string;
  label: string;
  asOf: string;
  ttmCapex: number;
  ttmOperatingCashFlow: number;
  ttmFreeCashFlow: number;
  capexGrowthYoy: number | null;
  cashCoverageRatio: number | null;
  financingStatus: string;
}

export type CostOfCapitalYieldCategory = "cash" | "ust" | "credit" | "fx" | "equity";

export interface CostOfCapitalYield {
  key: string;
  label: string;
  category: CostOfCapitalYieldCategory;
  unit: "%";
  basis: "美元年化" | "本币年化" | "美元年化近似";
  source: string;
  sourceUrl: string;
  description: string;
  latestDate: string;
  latestValue: number | null;
  previousValue: number | null;
  oneMonthChange: number | null;
  threeMonthChange: number | null;
  sixMonthChange: number | null;
  vsAnchorBp: number | null;
  fxMove?: number | null;
  fxContribution?: number | null;
  localYield?: number | null;
  peRatio?: number | null;
  series: DataPoint[];
}

export interface CostOfCapitalSpread {
  key: string;
  label: string;
  unit: "%" | "bp" | "点";
  source: string;
  sourceUrl: string;
  description: string;
  latestDate: string;
  latestValue: number | null;
  previousValue: number | null;
  oneMonthChange: number | null;
  threeMonthChange: number | null;
  series: DataPoint[];
}

export interface CostOfCapitalAnchor {
  key: string;
  label: string;
  unit: "%";
  latestDate: string;
  latestValue: number | null;
  previousValue: number | null;
  oneMonthChange: number | null;
  percentile: number | null;
  source: string;
  sourceUrl: string;
  description: string;
}

export interface CostOfCapitalDataset {
  anchor: CostOfCapitalAnchor;
  yields: CostOfCapitalYield[];
  spreads: CostOfCapitalSpread[];
  charts: InterestRateChart[];
}

export interface LiquidityDataset {
  generatedAt: string;
  lookbackYears: number;
  dateRange: {
    start: string;
    end: string;
  };
  indicators: IndicatorDefinition[];
  snapshots: IndicatorSnapshot[];
  rateCharts?: InterestRateChart[];
  inflationCharts?: InterestRateChart[];
  riskCharts?: InterestRateChart[];
  treasuryCharts?: InterestRateChart[];
  capexCharts?: InterestRateChart[];
  capexCommitments?: AiCapexCommitment[];
  capexCompanyMetrics?: AiCapexCompanyMetrics[];
  costOfCapital?: CostOfCapitalDataset;
  holderShares?: HolderShare[];
  foreignHolderShares?: HolderShare[];
  composite: {
    score: number | null;
    label: string;
    date: string | null;
    series: DataPoint[];
  };
  notes: string[];
}
