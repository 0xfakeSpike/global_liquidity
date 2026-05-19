import { Activity, Database, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LineChart } from "./components/LineChart";
import { ScoreGauge } from "./components/ScoreGauge";
import { loadLiquidityDataset, type LiquidityMarket } from "./lib/data";
import { formatChange, formatNumber, scoreTone } from "./lib/format";
import type { IndicatorDefinition, IndicatorSnapshot, LiquidityDataset } from "./types/liquidity";
import "./styles.css";

const markets: Record<
  LiquidityMarket,
  {
    label: string;
    eyebrow: string;
    title: string;
    description: string;
    sourceLabel: string;
    updateLabel: string;
  }
> = {
  usd: {
    label: "美元流动性",
    eyebrow: "美元全球流动性监控",
    title: "把 Fed 资产、TGA、ON RRP、融资压力和风险价格放到一张表里。",
    description: "每张图表按指标依次展开，构建阶段自动更新公开数据，页面端读取最新发布快照。",
    sourceLabel: "FRED / NY Fed",
    updateLabel: "Build-time JSON"
  },
  jpy: {
    label: "日元流动性",
    eyebrow: "日元全球流动性监控",
    title: "把 BOJ 资产、基础货币、当座存款、广义流动性和日元融资压力放到一张表里。",
    description: "数据来自 BOJ 官方统计 API 与 FRED 镜像序列，构建阶段生成日元流动性快照。",
    sourceLabel: "BOJ / FRED",
    updateLabel: "Build-time JSON"
  }
};

function initialMarket(): LiquidityMarket {
  return window.location.hash.includes("jpy") ? "jpy" : "usd";
}

function App() {
  const [dataset, setDataset] = useState<LiquidityDataset | null>(null);
  const [market, setMarket] = useState<LiquidityMarket>(initialMarket);

  useEffect(() => {
    window.location.hash = market === "jpy" ? "jpy" : "usd";
    setDataset(null);
    loadLiquidityDataset(market).then(setDataset);
  }, [market]);

  const snapshotMap = useMemo(() => {
    return new Map(dataset?.snapshots.map((snapshot) => [snapshot.key, snapshot]) ?? []);
  }, [dataset]);

  const marketConfig = markets[market];

  if (!dataset) {
    return <div className="loading">Loading liquidity monitor...</div>;
  }

  const looseCount = dataset.snapshots.filter((item) => (item.scoreContribution ?? 0) > 0).length;
  const tightCount = dataset.snapshots.filter((item) => (item.scoreContribution ?? 0) < 0).length;

  return (
    <main>
      <header className="hero">
        <nav>
          <div className="brand">
            <Activity size={21} />
            <span>Global Liquidity Monitor</span>
          </div>
          <div className="market-tabs" aria-label="liquidity market">
            {Object.entries(markets).map(([key, item]) => (
              <button
                className={key === market ? "active" : ""}
                key={key}
                onClick={() => setMarket(key as LiquidityMarket)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="nav-meta">
            {market === "usd" ? (
              <>
                <span>FRED</span>
                <span>Treasury</span>
                <span>NY Fed</span>
              </>
            ) : (
              <>
                <span>BOJ</span>
                <span>FRED</span>
                <span>OECD</span>
              </>
            )}
          </div>
        </nav>

        <section className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">{marketConfig.eyebrow}</p>
            <h1>{marketConfig.title}</h1>
            <p className="hero-text">{marketConfig.description}</p>
            <div className="hero-actions">
              <a href="#terminal">查看图表</a>
              <a href="#terminal">图表数据来源</a>
            </div>
          </div>
          <div className="summary-panel">
            <ScoreGauge score={dataset.composite.score} label={dataset.composite.label} />
            <div className="summary-copy">
              <span>最后更新 {dataset.composite.date ?? "n/a"}</span>
              <strong className={scoreTone(dataset.composite.score)}>
                DLI {dataset.composite.score === null ? "n/a" : formatNumber(dataset.composite.score, 0)}
              </strong>
              <p>
                宽松贡献 {looseCount} 项，收紧贡献 {tightCount} 项。评分采用十年 Z-score 方向化加权，作为流动性温度计而非交易信号。
              </p>
            </div>
          </div>
        </section>
      </header>

      <section className="metric-strip">
        <Metric icon={<Database size={20} />} label="公开数据源" value={marketConfig.sourceLabel} />
        <Metric icon={<RefreshCw size={20} />} label="更新方式" value={marketConfig.updateLabel} />
        <Metric icon={<ShieldCheck size={20} />} label="口径" value={`${dataset.lookbackYears}Y Z-score`} />
      </section>

      <section className="terminal" id="terminal">
        <div className="section-heading">
          <p>Indicator Terminal</p>
          <h2>全部指标图表</h2>
        </div>

        <div className="charts-stack">
          {dataset.indicators.map((definition) => {
            const snapshot = snapshotMap.get(definition.key);
            if (!snapshot) return null;
            return <IndicatorChart key={definition.key} definition={definition} snapshot={snapshot} />;
          })}
        </div>
      </section>

      <section className="composite-section">
        <div className="section-heading">
          <p>Composite DLI</p>
          <h2>综合流动性指数</h2>
        </div>
        <div className="composite-grid">
          <div>
            <LineChart series={dataset.composite.series.slice(-520)} color="#0f766e" valueLabel="综合流动性评分" />
          </div>
          <div className="notes">
            {dataset.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        </div>
      </section>

      <footer>
        <span>Generated at {new Date(dataset.generatedAt).toLocaleString("zh-CN")}</span>
        <span>仅供研究与教育用途，不构成投资建议。</span>
      </footer>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function IndicatorChart({
  definition,
  snapshot
}: {
  definition: IndicatorDefinition;
  snapshot: IndicatorSnapshot;
}) {
  return (
    <section className="chart-panel" id={definition.key}>
      <div className="chart-header">
        <div>
          <span>{definition.group}</span>
          <h3>{definition.name}</h3>
        </div>
        <div className="latest-value">
          <strong>{formatNumber(snapshot.latestValue)}</strong>
          <small>{definition.unit}</small>
        </div>
      </div>
      <LineChart
        series={snapshot.series.slice(-520)}
        color={definition.direction === "up_is_looser" ? "#16a34a" : "#dc2626"}
        valueLabel={definition.name}
      />
      <div className="chart-stats">
        <Stat label="最新日期" value={snapshot.latestDate} />
        <Stat label="1D 变化" value={formatChange(snapshot.oneDayChange)} />
        <Stat label="1M 变化" value={formatChange(snapshot.oneMonthChange)} />
        <Stat label="历史位置" value={snapshot.percentile === null ? "n/a" : `${Math.round(snapshot.percentile)}%`} />
        <Stat label="Z-score" value={formatNumber(snapshot.zScore, 2)} />
      </div>
      <div className="interpretation">
        <strong>当前解读</strong>
        <p>
          {definition.shortName} 当前值为 {formatNumber(snapshot.latestValue)} {definition.unit}。
          方向定义为{definition.direction === "up_is_looser" ? "上升偏宽松" : "上升偏收紧"}；
          当前对综合评分贡献为 {formatNumber(snapshot.scoreContribution, 3)}。
        </p>
        <p>{definition.description}</p>
      </div>
      <div className="data-source">
        <span>数据来源</span>
        <a href={definition.sourceUrl} target="_blank" rel="noreferrer">
          {definition.source}
        </a>
        <p>{definition.formula ?? definition.description}</p>
      </div>
    </section>
  );
}

export default App;
