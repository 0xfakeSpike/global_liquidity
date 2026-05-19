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

export interface InterestRateRow {
  key: string;
  name: string;
  latestDate: string;
  latestValue: number | string;
  unit: string;
  oneDayChange: number | null;
  oneMonthChange: number | null;
  source: string;
  sourceUrl: string;
  description: string;
}

export interface InterestRateTable {
  title: string;
  description: string;
  rows: InterestRateRow[];
}

export interface LiquidityDataset {
  generatedAt: string;
  lookbackYears: number;
  indicators: IndicatorDefinition[];
  snapshots: IndicatorSnapshot[];
  rateTables?: InterestRateTable[];
  composite: {
    score: number | null;
    label: string;
    date: string | null;
    series: DataPoint[];
  };
  notes: string[];
}
