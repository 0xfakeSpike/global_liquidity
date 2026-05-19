export interface DateRange {
  start: string;
  end: string;
}

export function dateTicks(range: DateRange, count = 6) {
  const start = Date.parse(`${range.start}T00:00:00Z`);
  const end = Date.parse(`${range.end}T00:00:00Z`);
  const steps = Math.max(1, count - 1);

  return Array.from({ length: count }, (_, index) => {
    const timestamp = start + ((end - start) * index) / steps;
    const date = new Date(timestamp);
    return date.toISOString().slice(0, 10);
  });
}

