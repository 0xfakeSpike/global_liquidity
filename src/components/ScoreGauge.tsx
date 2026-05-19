import { scoreTone } from "../lib/format";

interface ScoreGaugeProps {
  score: number | null;
  label: string;
}

export function ScoreGauge({ score, label }: ScoreGaugeProps) {
  const numeric = score ?? 50;
  const circumference = 2 * Math.PI * 58;
  const progress = Math.max(0, Math.min(100, numeric)) / 100;

  return (
    <div className={`score-gauge ${scoreTone(score)}`}>
      <svg viewBox="0 0 140 140" aria-label="综合流动性评分">
        <circle className="gauge-track" cx="70" cy="70" r="58" />
        <circle
          className="gauge-progress"
          cx="70"
          cy="70"
          r="58"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
        />
      </svg>
      <div className="gauge-content">
        <span>{score === null ? "--" : Math.round(score)}</span>
        <strong>{label}</strong>
      </div>
    </div>
  );
}
