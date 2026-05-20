import { useState, type PointerEvent } from "react";
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
  const [hovered, setHovered] = useState<{ point: DataPoint; x: number; y: number; tooltipX: number; tooltipY: number } | null>(
    null
  );
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
  const yForValue = (value: number) => padding.top + (1 - (value - min) / range) * usableHeight;

  const nearestPoint = (x: number) => {
    const timestamp = domainStart + ((x - padding.left) / usableWidth) * domainRange;
    return series.reduce((nearest, point) => {
      const distance = Math.abs(Date.parse(`${point.date}T00:00:00Z`) - timestamp);
      const nearestDistance = Math.abs(Date.parse(`${nearest.date}T00:00:00Z`) - timestamp);
      return distance < nearestDistance ? point : nearest;
    }, series[0]);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const rawX = ((event.clientX - rect.left) / rect.width) * width;
    const x = Math.max(padding.left, Math.min(width - padding.right, rawX));
    const point = nearestPoint(x);
    const chartX = xForDate(point.date);
    const chartY = yForValue(point.value);
    setHovered({
      point,
      x: chartX,
      y: chartY,
      tooltipX: Math.min((chartX / width) * rect.width + 12, rect.width - 172),
      tooltipY: Math.max((chartY / height) * rect.height - 52, 8)
    });
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
    <div className="chart-interactive-wrap" onPointerLeave={() => setHovered(null)} onPointerMove={handlePointerMove}>
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
        cy={yForValue(latest.value)}
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
      {hovered ? (
        <g className="chart-tooltip">
          <line className="chart-crosshair" x1={hovered.x} x2={hovered.x} y1={padding.top} y2={height - padding.bottom} />
          <line className="chart-crosshair" x1={padding.left} x2={width - padding.right} y1={hovered.y} y2={hovered.y} />
          <circle cx={hovered.x} cy={hovered.y} r="4" fill={color} />
        </g>
      ) : null}
      </svg>
      {hovered ? (
        <div className="chart-floating-tooltip" style={{ left: hovered.tooltipX, top: hovered.tooltipY }}>
          <strong>{hovered.point.date}</strong>
          <span>{formatNumber(hovered.point.value, 3)}</span>
        </div>
      ) : null}
    </div>
  );
}
