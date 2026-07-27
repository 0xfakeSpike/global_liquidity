export type ChartRangeYears = 3 | 5 | 10;

const ranges: ChartRangeYears[] = [3, 5, 10];

export function ChartRangeControl({
  onChange,
  value
}: {
  onChange: (value: ChartRangeYears) => void;
  value: ChartRangeYears;
}) {
  return (
    <div className="chart-range-control" aria-label="图表时间范围">
      {ranges.map((years) => (
        <button
          aria-pressed={value === years}
          className={value === years ? "active" : ""}
          key={years}
          onClick={() => onChange(years)}
          type="button"
        >
          {years}年
        </button>
      ))}
    </div>
  );
}

export function recentRange(endDate: string, years: ChartRangeYears) {
  const start = new Date(`${endDate}T00:00:00Z`);
  start.setUTCFullYear(start.getUTCFullYear() - years);
  return {
    start: start.toISOString().slice(0, 10),
    end: endDate
  };
}
