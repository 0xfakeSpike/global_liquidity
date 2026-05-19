import type { DataPoint } from "../types/liquidity";
import { formatNumber } from "../lib/format";
import { dateTicks, type DateRange } from "../lib/chartAxis";

interface LineChartProps {
  series: DataPoint[];
  color?: string;
  dateRange?: DateRange;
  height?: number;
  valueLabel?: string;
}

export function LineChart({ series, color = "#2563eb", dateRange, height = 240, valueLabel }: LineChartProps) {
  const width = 760;
  const padding = { top: 18, right: 18, bottom: 28, left: 46 };
  const usableWidth = width - padding.left - padding.right;
  const usableHeight = height - padding.top - padding.bottom;
  if (series.length === 0) {
    return <div className="chart-empty">暂无数据</div>;
  }

  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const domainStart = Date.parse(`${dateRange?.start ?? series[0]?.date}T00:00:00Z`);
  const domainEnd = Date.parse(`${dateRange?.end ?? series.at(-1)?.date}T00:00:00Z`);
  const domainRange = domainEnd - domainStart || 1;
  const domainLabels = {
    start: dateRange?.start ?? series[0]?.date,
    end: dateRange?.end ?? series.at(-1)?.date ?? series[0]?.date
  };
  const ticks = dateTicks(domainLabels);

  const xForDate = (date: string) => {
    const timestamp = Date.parse(`${date}T00:00:00Z`);
    return padding.left + ((timestamp - domainStart) / domainRange) * usableWidth;
  };

  const path = series
    .map((point, index) => {
      const x = xForDate(point.date);
      const y = padding.top + (1 - (point.value - min) / range) * usableHeight;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  const latest = series[series.length - 1];

  return (
    <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={valueLabel ?? "指标走势图"}>
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
      <path d={path} stroke={color} />
      <circle
        cx={xForDate(latest.date)}
        cy={padding.top + (1 - (latest.value - min) / range) * usableHeight}
        r="4"
        fill={color}
      />
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
  );
}
