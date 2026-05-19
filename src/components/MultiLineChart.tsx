import { formatNumber } from "../lib/format";
import { dateTicks, type DateRange } from "../lib/chartAxis";
import type { DataPoint } from "../types/liquidity";

interface MultiLineSeries {
  label: string;
  color: string;
  points: DataPoint[];
}

interface MultiLineChartProps {
  series: MultiLineSeries[];
  dateRange?: DateRange;
  height?: number;
  valueLabel?: string;
}

export function MultiLineChart({ series, dateRange, height = 260, valueLabel }: MultiLineChartProps) {
  const width = 760;
  const padding = { top: 18, right: 18, bottom: 28, left: 46 };
  const usableWidth = width - padding.left - padding.right;
  const usableHeight = height - padding.top - padding.bottom;
  const points = series.flatMap((item) => item.points);

  if (points.length === 0) {
    return <div className="chart-empty">暂无数据</div>;
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const firstDate = points.reduce((first, point) => (point.date < first ? point.date : first), points[0].date);
  const lastDate = points.reduce((last, point) => (point.date > last ? point.date : last), points[0].date);
  const domainStartLabel = dateRange?.start ?? firstDate;
  const domainEndLabel = dateRange?.end ?? lastDate;
  const domainStart = Date.parse(`${domainStartLabel}T00:00:00Z`);
  const domainEnd = Date.parse(`${domainEndLabel}T00:00:00Z`);
  const domainRange = domainEnd - domainStart || 1;
  const ticks = dateTicks({ start: domainStartLabel, end: domainEndLabel });

  const xForDate = (date: string) => {
    const timestamp = Date.parse(`${date}T00:00:00Z`);
    return padding.left + ((timestamp - domainStart) / domainRange) * usableWidth;
  };

  const toPath = (items: DataPoint[]) =>
    items
      .map((point, index) => {
        const x = xForDate(point.date);
        const y = padding.top + (1 - (point.value - min) / range) * usableHeight;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");

  return (
    <div className="multi-chart-wrap">
      <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={valueLabel ?? "叠加走势图"}>
        <line x1={padding.left} x2={width - padding.right} y1={padding.top} y2={padding.top} />
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={padding.top + usableHeight / 2}
          y2={padding.top + usableHeight / 2}
        />
        <line x1={padding.left} x2={width - padding.right} y1={height - padding.bottom} y2={height - padding.bottom} />
        <text x={padding.left - 8} y={padding.top + 4} textAnchor="end">
          {formatNumber(max)}
        </text>
        <text x={padding.left - 8} y={height - padding.bottom} textAnchor="end">
          {formatNumber(min)}
        </text>
        {series.map((item) => {
          const latest = item.points.at(-1);
          return (
            <g key={item.label}>
              <path d={toPath(item.points)} stroke={item.color} />
              {latest ? (
                <circle
                  cx={xForDate(latest.date)}
                  cy={padding.top + (1 - (latest.value - min) / range) * usableHeight}
                  r="4"
                  fill={item.color}
                />
              ) : null}
            </g>
          );
        })}
        {ticks.map((tick, index) => {
          const x = xForDate(tick);
          const isFirst = index === 0;
          const isLast = index === ticks.length - 1;
          return (
            <g key={tick}>
              <line x1={x} x2={x} y1={height - padding.bottom} y2={height - padding.bottom + 4} />
              <text x={x} y={height - 8} textAnchor={isFirst ? "start" : isLast ? "end" : "middle"}>
                {tick.slice(0, 7)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="multi-chart-legend">
        {series.map((item) => (
          <span key={item.label}>
            <i style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
