import { Activity, Database, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LineChart } from "./components/LineChart";
import { MultiLineChart } from "./components/MultiLineChart";
import { loadLiquidityDataset, type LiquidityMarket } from "./lib/data";
import { formatChange, formatNumber } from "./lib/format";
import type {
  DataPoint,
  HolderShare,
  IndicatorDefinition,
  IndicatorSnapshot,
  InterestRateChart,
  LiquidityDataset
} from "./types/liquidity";
import "./styles.css";

type ViewMode = LiquidityMarket | "combined";

const markets: Record<
  ViewMode,
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
  },
  risk: {
    label: "风险市场",
    eyebrow: "风险资产价格监控",
    title: "把 BTC、纳斯达克和恒生科技放到同一时间轴里。",
    description: "三条价格曲线按首个可用日期归一为 100，用来观察风险资产之间的相对强弱和节奏。",
    sourceLabel: "FRED / Yahoo",
    updateLabel: "Normalized prices"
  },
  treasury: {
    label: "美债市场",
    eyebrow: "美国国债市场监控",
    title: "把债务规模、持有人结构、收益率曲线和财政利息成本放到一页里。",
    description: "跟踪美债供给、谁在吸收美债、长短端利率和曲线形态，观察美元资产定价的底层锚。",
    sourceLabel: "FRED / Treasury",
    updateLabel: "Build-time JSON"
  },
  combined: {
    label: "美元+日元叠加",
    eyebrow: "美元与日元流动性叠加监控",
    title: "把美元和日元对应指标标准化到同一坐标系，观察全球资金主轴的相对变化。",
    description: "每组曲线以首个共同日期为 100，避免美元、日元单位和频率不同导致误读。",
    sourceLabel: "FRED / NY Fed / BOJ",
    updateLabel: "Normalized overlay"
  }
};

function initialMarket(): ViewMode {
  if (window.location.hash.includes("combined")) return "combined";
  if (window.location.hash.includes("treasury")) return "treasury";
  if (window.location.hash.includes("risk")) return "risk";
  return window.location.hash.includes("jpy") ? "jpy" : "usd";
}

function App() {
  const [dataset, setDataset] = useState<LiquidityDataset | null>(null);
  const [pairedDatasets, setPairedDatasets] = useState<{ usd: LiquidityDataset; jpy: LiquidityDataset } | null>(null);
  const [market, setMarket] = useState<ViewMode>(initialMarket);

  useEffect(() => {
    window.location.hash = market;
    setDataset(null);
    setPairedDatasets(null);
    if (market === "combined") {
      Promise.all([loadLiquidityDataset("usd"), loadLiquidityDataset("jpy")]).then(([usd, jpy]) =>
        setPairedDatasets({ usd, jpy })
      );
    } else {
      loadLiquidityDataset(market).then(setDataset);
    }
  }, [market]);

  const snapshotMap = useMemo(() => {
    return new Map(dataset?.snapshots.map((snapshot) => [snapshot.key, snapshot]) ?? []);
  }, [dataset]);

  const marketConfig = markets[market];

  if (market !== "combined" && !dataset) {
    return <div className="loading">Loading liquidity monitor...</div>;
  }

  if (market === "combined" && !pairedDatasets) {
    return <div className="loading">Loading liquidity monitor...</div>;
  }

  const activeDataset = dataset ?? pairedDatasets?.usd ?? null;
  if (!activeDataset) {
    return <div className="loading">Loading liquidity monitor...</div>;
  }

  const rateCharts =
    market === "combined" && pairedDatasets
      ? [...(pairedDatasets.usd.rateCharts ?? []), ...(pairedDatasets.jpy.rateCharts ?? [])]
      : market === "risk"
        ? []
        : (activeDataset.rateCharts ?? []);
  const inflationCharts =
    market === "combined" && pairedDatasets
      ? [...(pairedDatasets.usd.inflationCharts ?? []), ...(pairedDatasets.jpy.inflationCharts ?? [])]
      : market === "risk"
        ? []
        : (activeDataset.inflationCharts ?? []);
  const riskCharts = activeDataset.riskCharts ?? [];
  const treasuryCharts = activeDataset.treasuryCharts ?? [];

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
                onClick={() => setMarket(key as ViewMode)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="nav-meta">
            {market === "combined" ? (
              <>
                <span>FRED</span>
                <span>BOJ</span>
                <span>Overlay</span>
              </>
            ) : market === "risk" ? (
              <>
                <span>BTC</span>
                <span>Nasdaq</span>
                <span>HSTECH</span>
              </>
            ) : market === "treasury" ? (
              <>
                <span>Debt</span>
                <span>Holders</span>
                <span>Yield Curve</span>
              </>
            ) : market === "usd" ? (
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
        </section>
      </header>

      <section className="metric-strip">
        <Metric icon={<Database size={20} />} label="公开数据源" value={marketConfig.sourceLabel} />
        <Metric icon={<RefreshCw size={20} />} label="更新方式" value={marketConfig.updateLabel} />
        <Metric icon={<ShieldCheck size={20} />} label="口径" value={`${activeDataset.lookbackYears}Y Z-score`} />
      </section>

      {market !== "combined" && rateCharts.length > 0 ? (
        <InterestRateSection charts={rateCharts} dateRange={activeDataset.dateRange} />
      ) : null}

      {market !== "combined" && inflationCharts.length > 0 ? (
        <ChartGroupSection
          charts={inflationCharts}
          dateRange={activeDataset.dateRange}
          eyebrow="Inflation / Real Rate"
          title="通胀与实际政策利率"
          showRealRateImpact
        />
      ) : null}

      {market === "combined" && pairedDatasets ? (
        <>
          <CombinedTerminal usd={pairedDatasets.usd} jpy={pairedDatasets.jpy} />
          {rateCharts.length > 0 ? <InterestRateSection charts={rateCharts} dateRange={activeDataset.dateRange} /> : null}
          {inflationCharts.length > 0 ? (
            <ChartGroupSection
              charts={inflationCharts}
              dateRange={activeDataset.dateRange}
              eyebrow="Inflation / Real Rate"
              title="通胀与实际政策利率"
              showRealRateImpact
            />
          ) : null}
        </>
      ) : market === "risk" ? (
        <RiskMarketTerminal charts={riskCharts} dateRange={activeDataset.dateRange} notes={activeDataset.notes} />
      ) : market === "treasury" ? (
        <TreasuryMarketTerminal
          charts={treasuryCharts}
          dateRange={activeDataset.dateRange}
          holderShares={activeDataset.holderShares ?? []}
          notes={activeDataset.notes}
        />
      ) : dataset ? (
        <>
          <section className="terminal" id="terminal">
            <div className="section-heading">
              <p>Indicator Terminal</p>
              <h2>全部指标图表</h2>
            </div>

            <div className="charts-stack">
              {dataset.indicators.map((definition) => {
                const snapshot = snapshotMap.get(definition.key);
                if (!snapshot) return null;
                return (
                  <IndicatorChart
                    key={definition.key}
                    definition={definition}
                    snapshot={snapshot}
                    dateRange={dataset.dateRange}
                  />
                );
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
                <LineChart
                  series={dataset.composite.series}
                  color="#0f766e"
                  dateRange={dataset.dateRange}
                  valueLabel="综合流动性评分"
                />
              </div>
              <div className="notes">
                {dataset.notes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : null}

      <footer>
        <span>Generated at {new Date(activeDataset.generatedAt).toLocaleString("zh-CN")}</span>
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

function InterestRateSection({
  charts,
  dateRange
}: {
  charts: InterestRateChart[];
  dateRange: LiquidityDataset["dateRange"];
}) {
  return (
    <section className="rate-section">
      <div className="section-heading">
        <p>Policy Rates</p>
        <h2>央行利率曲线</h2>
      </div>
      <div className="rate-grid">
        {charts.map((chart) => (
          <div className="rate-card" key={chart.title}>
            <div className="rate-card-header">
              <h3>{chart.title}</h3>
              <p>{chart.description}</p>
            </div>
            <div className="rate-chart">
              <MultiLineChart series={chart.series} dateRange={dateRange} valueLabel={chart.title} />
            </div>
            <div className="rate-sources">
              {chart.series.map((item) => {
                const latest = item.points.at(-1);
                return (
                  <a href={item.sourceUrl} key={item.key} target="_blank" rel="noreferrer">
                    <strong>{item.label}</strong>
                    <span>
                      {latest ? `${latest.date} ${formatNumber(latest.value, 3)}${item.unit}` : "n/a"} · {item.source}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ChartGroupSection({
  charts,
  dateRange,
  eyebrow,
  title,
  showRealRateImpact = false
}: {
  charts: InterestRateChart[];
  dateRange: LiquidityDataset["dateRange"];
  eyebrow: string;
  title: string;
  showRealRateImpact?: boolean;
}) {
  return (
    <section className="rate-section">
      <div className="section-heading">
        <p>{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <div className="rate-grid">
        {charts.map((chart) => (
          <div className="rate-card" key={chart.title}>
            <div className="rate-card-header">
              <h3>{chart.title}</h3>
              <p>{chart.description}</p>
            </div>
            <div className="rate-chart">
              <MultiLineChart series={chart.series} dateRange={dateRange} valueLabel={chart.title} />
            </div>
            <div className="rate-sources">
              {chart.series.map((item) => {
                const latest = item.points.at(-1);
                return (
                  <a href={item.sourceUrl} key={item.key} target="_blank" rel="noreferrer">
                    <strong>{item.label}</strong>
                    <span>
                      {latest ? `${latest.date} ${formatNumber(latest.value, 3)}${item.unit}` : "n/a"} · {item.source}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {showRealRateImpact ? <RealRateImpactPanel charts={charts} /> : null}
    </section>
  );
}

function RealRateImpactPanel({ charts }: { charts: InterestRateChart[] }) {
  const realRateSignals = charts
    .map((chart) => {
      const realSeries = chart.series.find((item) => item.key.toLowerCase().includes("real"));
      const latest = realSeries?.points.at(-1);
      if (!realSeries || !latest) return null;
      return {
        market: chart.title.replace("通胀与实际政策利率", ""),
        label: realSeries.label,
        latest
      };
    })
    .filter(Boolean) as { market: string; label: string; latest: DataPoint }[];

  return (
    <div className="real-rate-impact">
      <div className="real-rate-impact-header">
        <span>Asset Attraction Framework</span>
        <h3>实际利率对其他资产吸引力的影响</h3>
        <p>
          名义短端利率决定账户里的现金收益、融资成本和 carry；实际政策利率决定现金在购买力维度是否真正变贵。
          对 BTC、黄金、成长股、港股科技这类高久期或抗通胀资产，最关键的是名义利率和实际利率是否同时偏高。
        </p>
      </div>
      <div className="real-rate-cards">
        <div className="real-rate-card">
          <strong>名义利率高</strong>
          <p>货币基金、短债和保证金现金回报更有吸引力，风险资产必须提供更高的预期回报来补偿波动。</p>
        </div>
        <div className="real-rate-card">
          <strong>实际利率高</strong>
          <p>现金和短债的购买力回报上升，黄金、BTC 和高估值成长股的估值压力更强。</p>
        </div>
        <div className="real-rate-card">
          <strong>实际利率低或为负</strong>
          <p>名义现金收益可能看起来不低，但购买力回报不足，抗通胀资产和高久期资产的相对吸引力更容易恢复。</p>
        </div>
      </div>
      {realRateSignals.length > 0 ? (
        <div className="real-rate-signals">
          {realRateSignals.map((signal) => (
            <div className="real-rate-signal" key={signal.label}>
              <span>{signal.market || signal.label}</span>
              <strong>{formatNumber(signal.latest.value, 2)}%</strong>
              <p>{realRatePressureText(signal.latest.value)}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function realRatePressureText(value: number) {
  if (value >= 2) return "实际现金回报偏高，对 BTC、黄金和高久期权益资产形成较强压制。";
  if (value >= 0) return "实际现金回报为正，风险资产需要盈利增长或流动性改善来抵消估值压力。";
  return "实际现金回报为负，现金购买力仍在被通胀侵蚀，抗通胀资产的相对吸引力更强。";
}

function RiskMarketTerminal({
  charts,
  dateRange,
  notes
}: {
  charts: InterestRateChart[];
  dateRange: LiquidityDataset["dateRange"];
  notes: string[];
}) {
  return (
    <section className="terminal" id="terminal">
      <div className="section-heading">
        <p>Risk Market Terminal</p>
        <h2>风险市场价格变化</h2>
      </div>
      <div className="overlay-note">
        每个风险资产使用独立纵轴，横轴统一为全站时间区间；价格按该资产首个可用日期归一为 100。
      </div>
      <div className="charts-stack">
        {charts.map((chart) => (
          <section className="chart-panel" key={chart.title}>
            <div className="chart-header">
              <div>
                <span>Normalized Price / Independent Y Axis</span>
                <h3>{chart.title}</h3>
              </div>
            </div>
            <MultiLineChart series={chart.series} dateRange={dateRange} valueLabel={chart.title} />
            <div className="interpretation">
              <strong>当前解读</strong>
              <p>{chart.description}</p>
            </div>
            <div className="rate-sources">
              {chart.series.map((item) => {
                const latest = item.points.at(-1);
                return (
                  <a href={item.sourceUrl} key={item.key} target="_blank" rel="noreferrer">
                    <strong>{item.label}</strong>
                    <span>
                      {latest ? `${latest.date} ${formatNumber(latest.value, 2)}` : "n/a"} · {item.source}
                    </span>
                  </a>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <div className="notes risk-notes">
        {notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </div>
    </section>
  );
}

function TreasuryMarketTerminal({
  charts,
  dateRange,
  holderShares,
  notes
}: {
  charts: InterestRateChart[];
  dateRange: LiquidityDataset["dateRange"];
  holderShares: HolderShare[];
  notes: string[];
}) {
  return (
    <section className="terminal" id="terminal">
      <div className="section-heading">
        <p>Treasury Market Terminal</p>
        <h2>美债市场核心指标</h2>
      </div>
      <div className="overlay-note">
        美债页分成三条主线：财政供给压力、投资者吸收结构、收益率曲线定价。规模类指标看供给，持有人结构看需求，长短端利率看资产定价锚。
      </div>
      {holderShares.length > 0 ? <HolderSharePanel shares={holderShares} /> : null}
      <div className="charts-stack treasury-stack">
        {charts.map((chart) => (
          <section className="chart-panel" key={chart.title}>
            <div className="chart-header">
              <div>
                <span>Treasury Monitor</span>
                <h3>{chart.title}</h3>
              </div>
            </div>
            <MultiLineChart series={chart.series} dateRange={dateRange} valueLabel={chart.title} />
            <div className="interpretation">
              <strong>当前解读</strong>
              <p>{chart.description}</p>
            </div>
            <div className="rate-sources">
              {chart.series.map((item) => {
                const latest = item.points.at(-1);
                return (
                  <a href={item.sourceUrl} key={item.key} target="_blank" rel="noreferrer">
                    <strong>{item.label}</strong>
                    <span>
                      {latest ? `${latest.date} ${formatNumber(latest.value, 3)}${item.unit}` : "n/a"} · {item.source}
                    </span>
                  </a>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <div className="notes risk-notes">
        {notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </div>
    </section>
  );
}

function HolderSharePanel({ shares }: { shares: HolderShare[] }) {
  const total = shares.reduce((sum, item) => sum + item.value, 0);
  return (
    <section className="holder-panel">
      <div className="holder-copy">
        <span>Ownership Structure</span>
        <h3>美债持有人份额</h3>
        <p>
          这里把公众持有美债拆成美国国内私人部门、海外与国际投资者、Federal Reserve Banks。
          若海外份额下降而发行继续上升，市场需要更多国内资金或更高收益率来吸收供给。
        </p>
      </div>
      <PieChart shares={shares} />
      <div className="holder-list">
        {shares.map((share) => {
          const percent = total > 0 ? (share.value / total) * 100 : 0;
          return (
            <a href={share.sourceUrl} key={share.key} target="_blank" rel="noreferrer">
              <i style={{ background: share.color }} />
              <span>{share.label}</span>
              <strong>{formatNumber(percent, 1)}%</strong>
              <small>
                {share.date} {formatNumber(share.value, 2)}
                {share.unit} · {share.source}
              </small>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function PieChart({ shares }: { shares: HolderShare[] }) {
  const total = shares.reduce((sum, item) => sum + item.value, 0);
  let offset = 25;
  const segments = shares.map((share) => {
    const percent = total > 0 ? (share.value / total) * 100 : 0;
    const segment = {
      ...share,
      dashArray: `${percent} ${100 - percent}`,
      dashOffset: offset
    };
    offset -= percent;
    return segment;
  });

  return (
    <div className="pie-wrap" aria-label="美债持有人份额饼图">
      <svg viewBox="0 0 42 42" role="img">
        <circle className="pie-bg" cx="21" cy="21" r="15.9155" />
        {segments.map((segment) => (
          <circle
            className="pie-segment"
            cx="21"
            cy="21"
            key={segment.key}
            r="15.9155"
            stroke={segment.color}
            strokeDasharray={segment.dashArray}
            strokeDashoffset={segment.dashOffset}
          />
        ))}
        <text x="21" y="19.5" textAnchor="middle">
          {shares[0]?.date.slice(0, 7)}
        </text>
        <text x="21" y="24" textAnchor="middle">
          {formatNumber(total, 1)}T
        </text>
      </svg>
    </div>
  );
}

function IndicatorChart({
  definition,
  snapshot,
  dateRange
}: {
  definition: IndicatorDefinition;
  snapshot: IndicatorSnapshot;
  dateRange: LiquidityDataset["dateRange"];
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
        series={snapshot.series}
        color={definition.direction === "up_is_looser" ? "#16a34a" : "#dc2626"}
        dateRange={dateRange}
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

function CombinedTerminal({ usd, jpy }: { usd: LiquidityDataset; jpy: LiquidityDataset }) {
  const usdMap = new Map(usd.snapshots.map((item) => [item.key, item]));
  const jpyMap = new Map(jpy.snapshots.map((item) => [item.key, item]));
  const usdEffr = usd.rateCharts?.flatMap((chart) => chart.series).find((item) => item.key === "effr");
  const jpyCallAverage = jpy.rateCharts
    ?.flatMap((chart) => chart.series)
    .find((item) => item.key === "jpyCallAverage");
  const rateSpread = usdEffr && jpyCallAverage ? spreadSeries(usdEffr.points, jpyCallAverage.points) : [];
  const pairs = [
    {
      title: "央行资产负债表",
      description: "Fed 总资产与 BOJ 总资产，观察两大央行基础流动性的相对扩张或收缩。",
      left: usdMap.get("fedBalanceSheet"),
      right: jpyMap.get("bojAssets"),
      leftLabel: "Fed WALCL",
      rightLabel: "BOJ JPNASSETS"
    },
    {
      title: "广义货币",
      description: "美国 M2 与日本 M2，观察两国广义货币环境的中周期方向。",
      left: usdMap.get("m2"),
      right: jpyMap.get("m2Japan"),
      leftLabel: "US M2",
      rightLabel: "Japan M2"
    },
    {
      title: "央行综合流动性评分",
      description: "美元 DLI 与日元 DLI 使用同一 0-100 评分区间，可直接比较宽松/收紧温度。",
      left: { series: usd.composite.series } as IndicatorSnapshot,
      right: { series: jpy.composite.series } as IndicatorSnapshot,
      leftLabel: "USD DLI",
      rightLabel: "JPY DLI",
      rawScale: true
    },
    {
      title: "长端利率约束",
      description: "美国 10Y 实际利率与日本 10Y 国债收益率，观察资金价格是否同步抬升。",
      left: usdMap.get("realYield10y"),
      right: jpyMap.get("jgb10y"),
      leftLabel: "US 10Y TIPS",
      rightLabel: "JGB 10Y"
    },
    {
      title: "汇率压力",
      description: "广义美元指数与 USD/JPY，观察美元强弱和日元套息环境是否同步变化。",
      left: usdMap.get("broadDollar"),
      right: jpyMap.get("usdJpy"),
      leftLabel: "Broad Dollar",
      rightLabel: "USD/JPY"
    }
  ];

  return (
    <section className="terminal" id="terminal">
      <div className="section-heading">
        <p>Overlay Terminal</p>
        <h2>美元与日元对应指标叠加</h2>
      </div>
      <div className="overlay-note">
        除 DLI 评分外，每组曲线均以首个共同日期归一为 100。这里看的是相对方向和节奏，不是绝对规模。
      </div>
      <div className="charts-stack">
        {rateSpread.length > 0 ? (
          <section className="chart-panel">
            <div className="chart-header">
              <div>
                <span>USD - JPY Rate Spread</span>
                <h3>美元-日元隔夜利差</h3>
              </div>
              <div className="latest-value">
                <strong>{formatNumber(rateSpread.at(-1)?.value, 3)}</strong>
                <small>pct</small>
              </div>
            </div>
            <LineChart series={rateSpread} color="#7c3aed" dateRange={usd.dateRange} valueLabel="美元-日元隔夜利差" />
            <div className="interpretation">
              <strong>当前解读</strong>
              <p>
                使用 EFFR 减去 BOJ 无担保隔夜拆借平均利率，观察美元相对日元的短端套息空间。
                利差扩大通常强化美元资产和美元融资回报优势；利差收窄则削弱日元融资 carry 的吸引力。
              </p>
            </div>
            <div className="data-source">
              <span>数据来源</span>
              <a href="https://fred.stlouisfed.org/series/EFFR" target="_blank" rel="noreferrer">
                FRED EFFR / BOJ FM01 STRDCLUCON
              </a>
              <p>公式：EFFR - BOJ 无担保隔夜拆借平均利率。</p>
            </div>
          </section>
        ) : null}
        {pairs.map((pair) => {
          if (!pair.left || !pair.right) return null;
          const series = pair.rawScale
            ? alignPair(pair.left.series, pair.right.series)
            : normalizePair(pair.left.series, pair.right.series);
          return (
            <section className="chart-panel" key={pair.title}>
              <div className="chart-header">
                <div>
                  <span>USD / JPY Overlay</span>
                  <h3>{pair.title}</h3>
                </div>
              </div>
              <MultiLineChart
                series={[
                  { label: pair.leftLabel, color: "#2563eb", points: series.left },
                  { label: pair.rightLabel, color: "#16a34a", points: series.right }
                ]}
                dateRange={usd.dateRange}
                valueLabel={pair.title}
              />
              <div className="interpretation">
                <strong>当前解读</strong>
                <p>{pair.description}</p>
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function alignPair(left: DataPoint[], right: DataPoint[]) {
  const rightMap = new Map(right.map((point) => [point.date, point.value]));
  const aligned = left
    .map((point) => {
      const rightValue = latestBeforeOrOn(rightMap, point.date);
      if (rightValue === undefined) return null;
      return { date: point.date, left: point.value, right: rightValue };
    })
    .filter(Boolean) as { date: string; left: number; right: number }[];

  return {
    left: aligned.map((point) => ({ date: point.date, value: point.left })),
    right: aligned.map((point) => ({ date: point.date, value: point.right }))
  };
}

function normalizePair(left: DataPoint[], right: DataPoint[]) {
  const aligned = alignPair(left, right);
  const leftBase = aligned.left[0]?.value;
  const rightBase = aligned.right[0]?.value;
  if (!leftBase || !rightBase) return aligned;

  return {
    left: aligned.left.map((point) => ({ date: point.date, value: (point.value / leftBase) * 100 })),
    right: aligned.right.map((point) => ({ date: point.date, value: (point.value / rightBase) * 100 }))
  };
}

function spreadSeries(left: DataPoint[], right: DataPoint[]) {
  const rightMap = new Map(right.map((point) => [point.date, point.value]));
  return left
    .map((point) => {
      const rightValue = latestBeforeOrOn(rightMap, point.date);
      if (rightValue === undefined) return null;
      return { date: point.date, value: point.value - rightValue };
    })
    .filter(Boolean) as DataPoint[];
}

function latestBeforeOrOn(map: Map<string, number>, date: string) {
  if (map.has(date)) return map.get(date);
  const keys = [...map.keys()].filter((item) => item <= date).sort();
  return keys.length > 0 ? map.get(keys[keys.length - 1]) : undefined;
}

export default App;
