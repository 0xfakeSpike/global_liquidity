import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatChange, formatNumber } from "../lib/format";
import type { IndicatorDefinition, IndicatorSnapshot } from "../types/liquidity";

interface IndicatorCardProps {
  definition: IndicatorDefinition;
  snapshot: IndicatorSnapshot;
  active: boolean;
  onSelect: () => void;
}

export function IndicatorCard({ definition, snapshot, active, onSelect }: IndicatorCardProps) {
  const change = snapshot.oneMonthChange ?? snapshot.oneDayChange;
  const Icon = change === null || change === 0 ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <button className={`indicator-card ${active ? "active" : ""}`} onClick={onSelect}>
      <div className="indicator-card-top">
        <span>{definition.group}</span>
        <Icon size={17} />
      </div>
      <strong>{definition.shortName}</strong>
      <div className="indicator-value">
        {formatNumber(snapshot.latestValue)}
        <small>{definition.unit}</small>
      </div>
      <div className="indicator-meta">
        <span>1M {formatChange(snapshot.oneMonthChange)}</span>
        <span>位置 {snapshot.percentile === null ? "n/a" : `${Math.round(snapshot.percentile)}%`}</span>
      </div>
    </button>
  );
}
