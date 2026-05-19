import type { DataPoint } from "../types/liquidity";
import { formatNumber } from "../lib/format";

interface LineChartProps {
  series: DataPoint[];
  color?: string;
  height?: number;
  valueLabel?: string;
}

export function LineChart({ series, color = "#2563eb", height = 240, valueLabel }: LineChartProps) {
  const width = 760;
  const padding = { top: 18, right: 18, bottom: 28, left: 46 };
  const usableWidth = width - padding.left - padding.right;
  const usableHeight = height - padding.top - padding.bottom;
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const path = series
    .map((point, index) => {
      const x = padding.left + (index / Math.max(1, series.length - 1)) * usableWidth;
      const y = padding.top + (1 - (point.value - min) / range) * usableHeight;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  if (series.length === 0) {
    return <div className="chart-empty">暂无数据</div>;
  }

  const latest = series[series.length - 1];
  const first = series[0];

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
        cx={width - padding.right}
        cy={padding.top + (1 - (latest.value - min) / range) * usableHeight}
        r="4"
        fill={color}
      />
      <text x={padding.left} y={height - 8}>
        {first?.date}
      </text>
      <text x={width - padding.right} y={height - 8} textAnchor="end">
        {latest?.date}
      </text>
    </svg>
  );
}
