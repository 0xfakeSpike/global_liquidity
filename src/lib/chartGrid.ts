export function gridTicks(min: number, max: number, targetCount = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];

  const range = Math.abs(max - min);
  const roughStep = range / Math.max(targetCount - 1, 1);
  const step = niceStep(roughStep);
  const start = Math.ceil(min / step) * step;
  const end = Math.floor(max / step) * step;
  const ticks: number[] = [];

  for (let value = start; value <= end + step * 0.5; value += step) {
    ticks.push(roundTick(value));
  }

  if (min < 0 && max > 0 && !ticks.some((value) => Math.abs(value) < step / 1000)) {
    ticks.push(0);
  }

  return [...new Set(ticks)].sort((left, right) => left - right);
}

function niceStep(value: number) {
  const exponent = Math.floor(Math.log10(value || 1));
  const base = 10 ** exponent;
  const normalized = value / base;
  if (normalized <= 1) return base;
  if (normalized <= 2) return 2 * base;
  if (normalized <= 5) return 5 * base;
  return 10 * base;
}

function roundTick(value: number) {
  if (Math.abs(value) < 1e-10) return 0;
  return Number(value.toPrecision(12));
}
