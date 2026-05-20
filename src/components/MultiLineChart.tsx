import { useState } from "react";
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
  const [hovered, setHovered] = useState<{
    date: string;
    items: { label: string; color: string; point: DataPoint }[];
    x: number;
  } | null>(null);
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
  const yForValue = (value: number) => padding.top + (1 - (value - min) / range) * usableHeight;

  const nearestPoint = (items: DataPoint[], timestamp: number) =>
    items.reduce((nearest, point) => {
      const distance = Math.abs(Date.parse(`${point.date}T00:00:00Z`) - timestamp);
      const nearestDistance = Math.abs(Date.parse(`${nearest.date}T00:00:00Z`) - timestamp);
      return distance < nearestDistance ? point : nearest;
    }, items[0]);

  const handlePointerMove = (event: React.PointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const rawX = ((event.clientX - rect.left) / rect.width) * width;
    const x = Math.max(padding.left, Math.min(width - padding.right, rawX));
    const timestamp = domainStart + ((x - padding.left) / usableWidth) * domainRange;
    const anchor = nearestPoint(points, timestamp);
    const items = series
      .map((item) => {
        if (item.points.length === 0) return null;
        return { label: item.label, color: item.color, point: nearestPoint(item.points, timestamp) };
      })
      .filter(Boolean) as { label: string; color: string; point: DataPoint }[];
    setHovered({ date: anchor.date, items, x: xForDate(anchor.date) });
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
                  cy={yForValue(latest.value)}
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
        <rect
          className="chart-hitbox"
          x={padding.left}
          y={padding.top}
          width={usableWidth}
          height={usableHeight}
          onPointerLeave={() => setHovered(null)}
          onPointerMove={handlePointerMove}
        />
        {hovered ? (
          <g className="chart-tooltip">
            <line className="chart-crosshair" x1={hovered.x} x2={hovered.x} y1={padding.top} y2={height - padding.bottom} />
            {hovered.items.map((item) => (
              <circle
                cx={xForDate(item.point.date)}
                cy={yForValue(item.point.value)}
                fill={item.color}
                key={item.label}
                r="3.5"
              />
            ))}
            <g transform={`translate(${Math.min(hovered.x + 12, width - 248)}, ${padding.top + 4})`}>
              <rect width="236" height={Math.min(26 + hovered.items.length * 17, height - 36)} rx="6" />
              <text x="10" y="17">{hovered.date}</text>
              {hovered.items.map((item, index) => (
                <text key={item.label} x="10" y={36 + index * 17}>
                  <tspan fill={item.color}>●</tspan> {item.label}: {formatNumber(item.point.value, 3)}
                </text>
              ))}
            </g>
          </g>
        ) : null}
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
