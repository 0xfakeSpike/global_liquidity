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
    sourceLabel: "FRED / NY Fed / BOJ / Treasury",
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
  const [pairedDatasets, setPairedDatasets] = useState<{
    usd: LiquidityDataset;
    jpy: LiquidityDataset;
    treasury: LiquidityDataset;
  } | null>(null);
  const [market, setMarket] = useState<ViewMode>(initialMarket);

  useEffect(() => {
    window.location.hash = market;
    setDataset(null);
    setPairedDatasets(null);
    if (market === "combined") {
      Promise.all([loadLiquidityDataset("usd"), loadLiquidityDataset("jpy"), loadLiquidityDataset("treasury")]).then(
        ([usd, jpy, treasury]) => setPairedDatasets({ usd, jpy, treasury })
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
          <LiquidityMomentumTerminal
            jpy={pairedDatasets.jpy}
            treasury={pairedDatasets.treasury}
            usd={pairedDatasets.usd}
          />
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
          foreignHolderShares={activeDataset.foreignHolderShares ?? []}
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
  foreignHolderShares,
  holderShares,
  notes
}: {
  charts: InterestRateChart[];
  dateRange: LiquidityDataset["dateRange"];
  foreignHolderShares: HolderShare[];
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
      {holderShares.length > 0 ? (
        <HolderSharePanel
          description="这里把公众持有美债拆成美国国内私人部门、海外与国际投资者、Federal Reserve Banks。若海外份额下降而发行继续上升，市场需要更多国内资金或更高收益率来吸收供给。"
          eyebrow="Ownership Structure"
          shares={holderShares}
          title="美债持有人份额"
        />
      ) : null}
      {foreignHolderShares.length > 0 ? (
        <HolderSharePanel
          description="这里继续拆分海外与国际投资者，展示 TIC Table 5 中最新一期主要国家/地区持有的美国国债。注意 TIC 按托管/报告地统计，不一定等于最终受益所有人。"
          eyebrow="Foreign Holders"
          shares={foreignHolderShares}
          title="海外主要持有人细分"
        />
      ) : null}
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

function HolderSharePanel({
  description,
  eyebrow,
  shares,
  title
}: {
  description: string;
  eyebrow: string;
  shares: HolderShare[];
  title: string;
}) {
  const total = shares.reduce((sum, item) => sum + item.value, 0);
  return (
    <section className="holder-panel">
      <div className="holder-copy">
        <span>{eyebrow}</span>
        <h3>{title}</h3>
        <p>{description}</p>
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

function LiquidityMomentumTerminal({
  jpy,
  treasury,
  usd
}: {
  jpy: LiquidityDataset;
  treasury: LiquidityDataset;
  usd: LiquidityDataset;
}) {
  const usdMap = new Map(usd.snapshots.map((item) => [item.key, item]));
  const jpyMap = new Map(jpy.snapshots.map((item) => [item.key, item]));
  const usdEffr = usd.rateCharts?.flatMap((chart) => chart.series).find((item) => item.key === "effr");
  const jpyCallAverage = jpy.rateCharts
    ?.flatMap((chart) => chart.series)
    .find((item) => item.key === "jpyCallAverage");
  const dgs10 = treasury.treasuryCharts?.flatMap((chart) => chart.series).find((item) => item.key === "dgs10");
  const dgs30 = treasury.treasuryCharts?.flatMap((chart) => chart.series).find((item) => item.key === "dgs30");
  const rateSpread = usdEffr && jpyCallAverage ? spreadSeries(usdEffr.points, jpyCallAverage.points) : [];

  const netLiquidity = usdMap.get("netLiquidity")?.series ?? [];
  const bojAssets = jpyMap.get("bojAssets")?.series ?? [];
  const fedAssets = usdMap.get("fedBalanceSheet")?.series ?? [];
  const usM2 = usdMap.get("m2")?.series ?? [];
  const japanM2 = jpyMap.get("m2Japan")?.series ?? [];
  const usdJpy = jpyMap.get("usdJpy")?.series ?? [];
  const jgb10y = jpyMap.get("jgb10y")?.series ?? [];

  const netLiquidityMomentum = [
    {
      label: "Δ4W",
      color: "#16a34a",
      points: absoluteChangeSeries(netLiquidity, 28)
    },
    {
      label: "Δ13W",
      color: "#2563eb",
      points: absoluteChangeSeries(netLiquidity, 91)
    },
    {
      label: "Δ26W",
      color: "#7c3aed",
      points: absoluteChangeSeries(netLiquidity, 182)
    }
  ];

  const quantityMomentum = [
    { label: "Fed净流动性 13W%", color: "#2563eb", points: percentChangeSeries(netLiquidity, 91) },
    { label: "Fed资产 13W%", color: "#0f766e", points: percentChangeSeries(fedAssets, 91) },
    { label: "BOJ资产 13W%", color: "#dc2626", points: percentChangeSeries(bojAssets, 91) },
    { label: "US M2 13W%", color: "#7c3aed", points: percentChangeSeries(usM2, 91) },
    { label: "Japan M2 13W%", color: "#f59e0b", points: percentChangeSeries(japanM2, 91) }
  ];

  const fundingImpulse = standardizeSeries([
    { label: "美日利差扩大", color: "#2563eb", points: absoluteChangeSeries(rateSpread, 91) },
    { label: "USDJPY上行", color: "#16a34a", points: percentChangeSeries(usdJpy, 91) },
    { label: "JGB下行", color: "#dc2626", points: invertSeries(absoluteChangeSeries(jgb10y, 91)) },
    { label: "US10Y下行", color: "#7c3aed", points: invertSeries(absoluteChangeSeries(dgs10?.points ?? [], 91)) },
    { label: "US30Y下行", color: "#f59e0b", points: invertSeries(absoluteChangeSeries(dgs30?.points ?? [], 91)) }
  ]);

  const latestSignals = [
    momentumSignal("美元净流动性 Δ13W", absoluteChangeSeries(netLiquidity, 91).at(-1)?.value, "万亿美元"),
    momentumSignal("美日利差 Δ13W", absoluteChangeSeries(rateSpread, 91).at(-1)?.value, "pct"),
    momentumSignal("USDJPY 13W", percentChangeSeries(usdJpy, 91).at(-1)?.value, "%"),
    momentumSignal("US10Y 下行冲击", invertSeries(absoluteChangeSeries(dgs10?.points ?? [], 91)).at(-1)?.value, "pct")
  ];

  return (
    <section className="terminal">
      <div className="section-heading">
        <p>Global Liquidity Momentum</p>
        <h2>全球流动性动量</h2>
      </div>
      <div className="overlay-note">
        存量决定水位，变化量决定方向，变化率的变化决定拐点。这里把数量流动性和融资条件都转成 4W、13W、26W 或 13W 动量观察，重点看风险资产的边际顺风/逆风。
      </div>
      <div className="momentum-summary">
        {latestSignals.map((signal) => (
          <div className="momentum-signal" key={signal.label}>
            <span>{signal.label}</span>
            <strong>{signal.value}</strong>
            <p>{signal.text}</p>
          </div>
        ))}
      </div>
      <div className="charts-stack">
        <section className="chart-panel">
          <div className="chart-header">
            <div>
              <span>Quantity Momentum</span>
              <h3>美元净流动性变化量</h3>
            </div>
          </div>
          <MultiLineChart series={netLiquidityMomentum} dateRange={usd.dateRange} valueLabel="美元净流动性变化量" />
          <div className="interpretation">
            <strong>当前解读</strong>
            <p>4W、13W、26W 分别对应短线、季度和半年度流动性动量。风险资产更敏感的是这些斜率变化，而不是净流动性绝对水位。</p>
          </div>
        </section>
        <section className="chart-panel">
          <div className="chart-header">
            <div>
              <span>Balance Sheet / Money Momentum</span>
              <h3>数量流动性 13周增速</h3>
            </div>
          </div>
          <MultiLineChart series={quantityMomentum} dateRange={usd.dateRange} valueLabel="数量流动性 13周增速" />
          <div className="interpretation">
            <strong>当前解读</strong>
            <p>把 Fed 净流动性、Fed 资产、BOJ 资产和两国 M2 都转为 13 周百分比变化，用来观察主要水位是否在同步加速或减速。</p>
          </div>
        </section>
        <section className="chart-panel">
          <div className="chart-header">
            <div>
              <span>Funding Momentum</span>
              <h3>融资条件 13周风险顺风指数</h3>
            </div>
          </div>
          <MultiLineChart series={fundingImpulse} dateRange={usd.dateRange} valueLabel="融资条件 13周风险顺风指数" />
          <div className="interpretation">
            <strong>当前解读</strong>
            <p>
              每条曲线已方向化并标准化：向上代表风险资产顺风，向下代表逆风。美日利差扩大、USDJPY 上行、JGB/US10Y/US30Y 下行都按顺风处理。
            </p>
          </div>
        </section>
      </div>
    </section>
  );
}

function momentumSignal(label: string, rawValue: number | undefined, unit: string) {
  if (rawValue === undefined) {
    return { label, value: "n/a", text: "数据不足，暂不判断。" };
  }
  const value = `${rawValue > 0 ? "+" : ""}${formatNumber(rawValue, 2)}${unit}`;
  const text = rawValue > 0 ? "边际顺风。" : rawValue < 0 ? "边际逆风。" : "边际中性。";
  return { label, value, text };
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

function absoluteChangeSeries(series: DataPoint[], days: number) {
  const map = new Map(series.map((point) => [point.date, point.value]));
  return series
    .map((point) => {
      const base = latestBeforeOrOn(map, offsetDate(point.date, -days));
      if (base === undefined) return null;
      return { date: point.date, value: point.value - base };
    })
    .filter(Boolean) as DataPoint[];
}

function percentChangeSeries(series: DataPoint[], days: number) {
  const map = new Map(series.map((point) => [point.date, point.value]));
  return series
    .map((point) => {
      const base = latestBeforeOrOn(map, offsetDate(point.date, -days));
      if (base === undefined || base === 0) return null;
      return { date: point.date, value: ((point.value / base) - 1) * 100 };
    })
    .filter(Boolean) as DataPoint[];
}

function invertSeries(series: DataPoint[]) {
  return series.map((point) => ({ date: point.date, value: -point.value }));
}

function standardizeSeries(series: { label: string; color: string; points: DataPoint[] }[]) {
  return series.map((item) => {
    const values = item.points.map((point) => point.value);
    const mean = values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(values.length - 1, 1);
    const standardDeviation = Math.sqrt(variance) || 1;
    return {
      ...item,
      points: item.points.map((point) => ({ date: point.date, value: (point.value - mean) / standardDeviation }))
    };
  });
}

function offsetDate(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function latestBeforeOrOn(map: Map<string, number>, date: string) {
  if (map.has(date)) return map.get(date);
  const keys = [...map.keys()].filter((item) => item <= date).sort();
  return keys.length > 0 ? map.get(keys[keys.length - 1]) : undefined;
}

export default App;
