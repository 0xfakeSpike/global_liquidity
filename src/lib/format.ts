export function formatNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "n/a";
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: Math.min(digits, 2)
  }).format(value);
}

export function formatChange(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, digits)}`;
}

export function scoreTone(score: number | null | undefined) {
  if (score === null || score === undefined) return "neutral";
  if (score >= 62) return "loose";
  if (score <= 38) return "tight";
  return "neutral";
}
