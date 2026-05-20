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
