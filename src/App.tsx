import { Activity, Database, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { IndicatorCard } from "./components/IndicatorCard";
import { LineChart } from "./components/LineChart";
import { ScoreGauge } from "./components/ScoreGauge";
import { SourceTable } from "./components/SourceTable";
import { loadLiquidityDataset } from "./lib/data";
import { formatChange, formatNumber, scoreTone } from "./lib/format";
import type { IndicatorDefinition, IndicatorSnapshot, LiquidityDataset, LiquiditySeriesKey } from "./types/liquidity";
import "./styles.css";

function App() {
  const [dataset, setDataset] = useState<LiquidityDataset | null>(null);
  const [activeKey, setActiveKey] = useState<LiquiditySeriesKey>("netLiquidity");

  useEffect(() => {
    loadLiquidityDataset().then((data) => {
      setDataset(data);
      if (!data.snapshots.some((item) => item.key === activeKey)) {
        setActiveKey(data.snapshots[0]?.key ?? "fedBalanceSheet");
      }
    });
  }, []);

  const snapshotMap = useMemo(() => {
    return new Map(dataset?.snapshots.map((snapshot) => [snapshot.key, snapshot]) ?? []);
  }, [dataset]);

  const definitionMap = useMemo(() => {
    return new Map(dataset?.indicators.map((indicator) => [indicator.key, indicator]) ?? []);
  }, [dataset]);

  const activeSnapshot = snapshotMap.get(activeKey) ?? dataset?.snapshots[0];
  const activeDefinition = activeSnapshot ? definitionMap.get(activeSnapshot.key) : undefined;

  if (!dataset || !activeSnapshot || !activeDefinition) {
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
            <span>Global Dollar Liquidity</span>
          </div>
          <div className="nav-meta">
            <span>FRED</span>
            <span>Treasury</span>
            <span>NY Fed</span>
          </div>
        </nav>

        <section className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">美元全球流动性监控</p>
            <h1>把 Fed 资产、TGA、ON RRP、融资压力和风险价格放到一张表里。</h1>
            <p className="hero-text">
              参考 DollarLiquidity 的终端式结构，核心区别是把数据抓取脚本和前端展示拆开：构建阶段更新公开数据，页面端只读本地快照。
            </p>
            <div className="hero-actions">
              <a href="#terminal">查看终端</a>
              <a href="#sources">数据来源</a>
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
        <Metric icon={<Database size={20} />} label="公开数据源" value="FRED / NY Fed" />
        <Metric icon={<RefreshCw size={20} />} label="更新方式" value="Build-time JSON" />
        <Metric icon={<ShieldCheck size={20} />} label="口径" value={`${dataset.lookbackYears}Y Z-score`} />
      </section>

      <section className="terminal" id="terminal">
        <div className="section-heading">
          <p>Indicator Terminal</p>
          <h2>指标终端视图</h2>
        </div>

        <div className="terminal-layout">
          <aside className="indicator-list">
            {dataset.indicators.map((definition) => {
              const snapshot = snapshotMap.get(definition.key);
              if (!snapshot) return null;
              return (
                <IndicatorCard
                  key={definition.key}
                  definition={definition}
                  snapshot={snapshot}
                  active={activeKey === definition.key}
                  onSelect={() => setActiveKey(definition.key)}
                />
              );
            })}
          </aside>

          <section className="chart-panel">
            <div className="chart-header">
              <div>
                <span>{activeDefinition.group}</span>
                <h3>{activeDefinition.name}</h3>
              </div>
              <div className="latest-value">
                <strong>{formatNumber(activeSnapshot.latestValue)}</strong>
                <small>{activeDefinition.unit}</small>
              </div>
            </div>
            <LineChart
              series={activeSnapshot.series.slice(-520)}
              color={activeDefinition.direction === "up_is_looser" ? "#16a34a" : "#dc2626"}
              valueLabel={activeDefinition.name}
            />
            <div className="chart-stats">
              <Stat label="最新日期" value={activeSnapshot.latestDate} />
              <Stat label="1D 变化" value={formatChange(activeSnapshot.oneDayChange)} />
              <Stat label="1M 变化" value={formatChange(activeSnapshot.oneMonthChange)} />
              <Stat label="历史位置" value={activeSnapshot.percentile === null ? "n/a" : `${Math.round(activeSnapshot.percentile)}%`} />
              <Stat label="Z-score" value={formatNumber(activeSnapshot.zScore, 2)} />
            </div>
            <div className="interpretation">
              <strong>当前解读</strong>
              <p>
                {activeDefinition.shortName} 当前值为 {formatNumber(activeSnapshot.latestValue)} {activeDefinition.unit}。
                方向定义为{activeDefinition.direction === "up_is_looser" ? "上升偏宽松" : "上升偏收紧"}；
                当前对综合评分贡献为 {formatNumber(activeSnapshot.scoreContribution, 3)}。
              </p>
              <p>{activeDefinition.description}</p>
            </div>
          </section>
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

      <div id="sources">
        <SourceTable indicators={dataset.indicators} />
      </div>

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

export default App;
