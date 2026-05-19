export type LiquiditySeriesKey =
  | "fedBalanceSheet"
  | "tga"
  | "onRrp"
  | "netLiquidity"
  | "m2"
  | "sofrIorb"
  | "srf"
  | "vix"
  | "hyOas"
  | "broadDollar"
  | "realYield10y";

export type IndicatorGroup =
  | "政策与准备金"
  | "融资与管道"
  | "信用与中介"
  | "风险与价格"
  | "广义流动性";

export interface DataPoint {
  date: string;
  value: number;
}

export interface IndicatorDefinition {
  key: LiquiditySeriesKey;
  name: string;
  shortName: string;
  group: IndicatorGroup;
  unit: string;
  source: string;
  sourceUrl: string;
  direction: "up_is_looser" | "up_is_tighter";
  weight: number;
  description: string;
  formula?: string;
}

export interface IndicatorSnapshot {
  key: LiquiditySeriesKey;
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

export interface LiquidityDataset {
  generatedAt: string;
  lookbackYears: number;
  indicators: IndicatorDefinition[];
  snapshots: IndicatorSnapshot[];
  composite: {
    score: number | null;
    label: string;
    date: string | null;
    series: DataPoint[];
  };
  notes: string[];
}
