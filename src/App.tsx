import { Activity, CalendarClock, Coins, ExternalLink, Flame, LockKeyhole } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { LineChart } from "./components/LineChart";
import { MultiLineChart } from "./components/MultiLineChart";
import { loadAsterDataset, loadLiquidityDataset, loadUpcomingEvents, type LiquidityMarket } from "./lib/data";
import { formatChange, formatNumber } from "./lib/format";
import type {
  AiCapexCompanyMetrics,
  AiCapexCommitment,
  AsterDataset,
  CostOfCapitalSpread,
  CostOfCapitalYield,
  DataPoint,
  HolderShare,
  IndicatorDefinition,
  IndicatorSnapshot,
  InterestRateChart,
  LiquidityDataset,
  UpcomingEvent
} from "./types/liquidity";
import "./styles.css";
import "./redesign.css";

type ViewMode = LiquidityMarket | "combined" | "aster";

const coreIndicatorKeys: Partial<Record<ViewMode, Set<string>>> = {
  usd: new Set(["netLiquidity", "m2", "sofrIorb", "hyOas", "broadDollar", "realYield10y"]),
  jpy: new Set(["bojAssets", "reserveBalances", "m2Japan", "jgb10y", "usdJpy"])
};

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
  combined: {
    label: "宏观流动性",
    eyebrow: "全球风险流动性仪表盘",
    title: "全球流动性对风险资产是顺风还是逆风？",
    description: "从美元水位、日元融资、美债压力和市场价格确认四个维度，判断风险偏好是否具备持续扩张的条件。",
    sourceLabel: "Fed / BOJ / 美国财政部",
    updateLabel: "工作日自动更新"
  },
  usd: {
    label: "美元流动性",
    eyebrow: "美元全球流动性监控",
    title: "美元流动性正在扩张，还是被财政与融资市场抽走？",
    description: "Fed 扩表提供流动性，TGA 与逆回购吸收流动性，融资利差验证银行体系是否真正宽松。",
    sourceLabel: "FRED / NY Fed",
    updateLabel: "Build-time JSON"
  },
  jpy: {
    label: "日元流动性",
    eyebrow: "日元全球流动性监控",
    title: "日本流动性与日元融资条件，正在支持还是压制全球风险偏好？",
    description: "同时观察 BOJ 货币投放、银行准备金、广义货币和日元融资成本，识别套息交易扩张或反转的环境。",
    sourceLabel: "BOJ / FRED",
    updateLabel: "Build-time JSON"
  },
  treasury: {
    label: "美债市场",
    eyebrow: "美国国债市场监控",
    title: "美债供给由谁承接，长端利率压力是否正在上升？",
    description: "债务增长只有在需求不足、期限溢价抬升或利息负担恶化时，才会显著收紧风险资产的估值环境。",
    sourceLabel: "FRED / Treasury",
    updateLabel: "Build-time JSON"
  },
  risk: {
    label: "风险市场",
    eyebrow: "风险资产价格监控",
    title: "风险偏好是否形成跨市场共振？",
    description: "比较 BTC、纳斯达克与恒生科技的方向和强弱；只有多类风险资产同步走强，流动性改善才更可信。",
    sourceLabel: "FRED / Yahoo",
    updateLabel: "Normalized prices"
  },
  capex: {
    label: "资本开支",
    eyebrow: "AI 产业资本开支",
    title: "AI 资本开支能否由经营现金流持续覆盖？",
    description: "用真实支出、同比增速与现金覆盖率检验投资周期质量；多年承诺仅作为远期需求线索，不计入当期支出。",
    sourceLabel: "SEC / Company IR",
    updateLabel: "Quarterly"
  },
  cost: {
    label: "利率锚",
    eyebrow: "资金成本与美元利率锚",
    title: "持有风险资产，是否足以补偿美元无风险收益？",
    description: "以美元现金利率为机会成本，比较美债、信用、海外债券和股票收益，识别风险溢价是否值得承担。",
    sourceLabel: "FRED / OECD / multpl",
    updateLabel: "Build-time JSON"
  },
  aster: {
    label: "ASTER 供给",
    eyebrow: "BNB Chain Token Monitor",
    title: "未来代币释放能否被回购与销毁吸收？",
    description: "区分市场流通、计划解锁、实际回购和链上销毁，判断 ASTER 的净供应压力是在扩大还是收敛。",
    sourceLabel: "Aster / BscScan / CMC",
    updateLabel: "披露与链上复核"
  }
};

function initialMarket(): ViewMode {
  const hash = window.location.hash.replace("#", "") as ViewMode;
  if (hash in markets) return hash;
  return "combined";
}

function App() {
  const [dataset, setDataset] = useState<LiquidityDataset | null>(null);
  const [pairedDatasets, setPairedDatasets] = useState<{
    risk: LiquidityDataset;
    usd: LiquidityDataset;
    jpy: LiquidityDataset;
    treasury: LiquidityDataset;
  } | null>(null);
  const [market, setMarket] = useState<ViewMode>(initialMarket);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [asterDataset, setAsterDataset] = useState<AsterDataset | null>(null);

  useEffect(() => {
    loadUpcomingEvents()
      .then((result) => setUpcomingEvents(result.events))
      .catch((error) => console.warn("Upcoming event calendar unavailable", error));
  }, []);

  useEffect(() => {
    window.location.hash = market;
    setDataset(null);
    setPairedDatasets(null);
    setAsterDataset(null);
    if (market === "combined") {
      Promise.all([
        loadLiquidityDataset("usd"),
        loadLiquidityDataset("jpy"),
        loadLiquidityDataset("treasury"),
        loadLiquidityDataset("risk")
      ]).then(([usd, jpy, treasury, risk]) =>
        setPairedDatasets({ risk, usd, jpy, treasury })
      );
    } else if (market === "aster") {
      loadAsterDataset().then(setAsterDataset);
    } else {
      loadLiquidityDataset(market).then(setDataset);
    }
  }, [market]);

  const snapshotMap = useMemo(() => {
    return new Map(dataset?.snapshots.map((snapshot) => [snapshot.key, snapshot]) ?? []);
  }, [dataset]);

  if (market === "aster" && !asterDataset) {
    return <div className="loading">Loading ASTER supply monitor...</div>;
  }

  if (market !== "combined" && market !== "aster" && !dataset) {
    return <div className="loading">Loading liquidity monitor...</div>;
  }

  if (market === "combined" && !pairedDatasets) {
    return <div className="loading">Loading liquidity monitor...</div>;
  }

  const activeDataset = dataset ?? pairedDatasets?.usd ?? null;
  if (!activeDataset && market !== "aster") {
    return <div className="loading">Loading liquidity monitor...</div>;
  }

  const rateCharts =
    market === "combined" && pairedDatasets
      ? [...(pairedDatasets.usd.rateCharts ?? []), ...(pairedDatasets.jpy.rateCharts ?? [])]
      : market === "risk"
        ? []
        : (activeDataset?.rateCharts ?? []);
  const inflationCharts =
    market === "combined" && pairedDatasets
      ? [...(pairedDatasets.usd.inflationCharts ?? []), ...(pairedDatasets.jpy.inflationCharts ?? [])]
      : market === "risk"
        ? []
        : (activeDataset?.inflationCharts ?? []);
  const riskCharts = activeDataset?.riskCharts ?? [];
  const treasuryCharts = activeDataset?.treasuryCharts ?? [];
  const decisionRateCharts = rateCharts.map((chart) => ({
    ...chart,
    series: chart.series.filter((series) =>
      market === "usd"
        ? ["effr", "fedSofr"].includes(series.key)
        : market === "jpy"
          ? series.key === "jpyCallAverage"
          : true
    )
  }));

  return (
    <main>
      <header className="hero hero-compact">
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
            ) : market === "cost" ? (
              <>
                <span>EFFR</span>
                <span>UST</span>
                <span>Credit / FX</span>
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

      </header>

      {market !== "aster" ? (
        <section className={`page-intro page-intro-${market}`}>
          <div>
            <span>{markets[market].eyebrow}</span>
            <h1>{markets[market].title}</h1>
            <p>{markets[market].description}</p>
          </div>
          <div className="page-intro-meta">
            <div><small>DATA SOURCE</small><strong>{markets[market].sourceLabel}</strong></div>
            <div><small>UPDATE MODE</small><strong>{markets[market].updateLabel}</strong></div>
          </div>
        </section>
      ) : null}

      {(market === "usd" || market === "jpy") && activeDataset && rateCharts.length > 0 ? (
        <LiquidityRateOverview
          dateRange={activeDataset.dateRange}
          inflationCharts={inflationCharts}
          rateCharts={decisionRateCharts}
        />
      ) : market !== "combined" && rateCharts.length > 0 && activeDataset ? (
        <InterestRateSection charts={rateCharts} dateRange={activeDataset.dateRange} />
      ) : null}

      {market !== "usd" && market !== "jpy" && market !== "combined" && inflationCharts.length > 0 && activeDataset ? (
        <ChartGroupSection
          charts={inflationCharts}
          dateRange={activeDataset.dateRange}
          eyebrow="Inflation / Real Rate"
          title="通胀与实际政策利率"
          showRealRateImpact
        />
      ) : null}

      {market === "aster" && asterDataset ? (
        <AsterSupplyTerminal dataset={asterDataset} />
      ) : market === "combined" && pairedDatasets ? (
        <>
          <GlobalLiquidityDashboard
            jpy={pairedDatasets.jpy}
            risk={pairedDatasets.risk}
            treasury={pairedDatasets.treasury}
            usd={pairedDatasets.usd}
            upcomingEvents={upcomingEvents}
          />
        </>
      ) : market === "risk" ? (
        <RiskMarketTerminal charts={riskCharts} dateRange={activeDataset!.dateRange} />
      ) : market === "capex" ? (
        <CapexTerminal dataset={activeDataset!} />
      ) : market === "cost" ? (
        <CostOfCapitalTerminal dataset={activeDataset!} />
      ) : market === "treasury" ? (
        <TreasuryMarketTerminal
          charts={treasuryCharts}
          dateRange={activeDataset!.dateRange}
          foreignHolderShares={activeDataset!.foreignHolderShares ?? []}
          holderShares={activeDataset!.holderShares ?? []}
          notes={activeDataset!.notes}
        />
      ) : dataset ? (
        <>
          <section className="terminal liquidity-detail-dashboard" id="terminal">
            <div className="section-heading">
              <p>Indicator Terminal</p>
              <h2>{market === "usd" ? "美元流动性的驱动项" : "日元流动性的驱动项"}</h2>
            </div>

            <div className="charts-stack">
              {dataset.indicators.filter((definition) => coreIndicatorKeys[market]?.has(definition.key) ?? true).map((definition) => {
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

          <section className="method-note">
            <strong>使用原则</strong>
            <p>只用这些指标调整中期风险预算，不把单个宏观序列当作买卖信号。价格趋势、信用利差与融资压力必须至少有两类同向确认。</p>
          </section>
        </>
      ) : null}

      <footer>
        <span>Generated at {new Date(asterDataset?.generatedAt ?? activeDataset?.generatedAt ?? "").toLocaleString("zh-CN")}</span>
        <span>仅供研究与教育用途，不构成投资建议。</span>
      </footer>
    </main>
  );
}

function AsterSupplyTerminal({ dataset }: { dataset: AsterDataset }) {
  const metricItems = Object.values(dataset.metrics);
  const circulating = dataset.metrics.circulating.value;
  const supply = dataset.metrics.totalSupply.value;
  const lockedOrReserved = Math.max(0, supply - circulating);
  const nextUnlock = dataset.unlocks.find((item) => new Date(`${item.date}T00:00:00Z`).getTime() >= Date.now());
  const fmtAster = (value: number) => `${formatNumber(value / 1_000_000, value >= 100_000_000 ? 1 : 2)}M`;

  return (
    <section className="terminal aster-dashboard" id="terminal">
      <div className="aster-title-row">
        <div>
          <span>ASTER · BNB SMART CHAIN</span>
          <h1>ASTER 净供应压力</h1>
          <p>计划释放形成潜在新增供应，协议收入回购与储备销毁形成对冲；两者的差额比单看解锁数量更有意义。</p>
        </div>
        <a className="contract-pill" href={`https://bscscan.com/token/${dataset.token.contract}`} target="_blank" rel="noreferrer">
          <span>合约</span>
          <strong>{dataset.token.contract.slice(0, 8)}…{dataset.token.contract.slice(-6)}</strong>
          <ExternalLink size={14} />
        </a>
      </div>

      <div className="aster-metric-grid">
        {metricItems.map((item, index) => (
          <article className="aster-metric-card" key={item.label}>
            <div className="aster-metric-icon">{index === 3 ? <Flame size={18} /> : index === 4 ? <Coins size={18} /> : <LockKeyhole size={18} />}</div>
            <span>{item.label}</span>
            <strong>{item.unit === "%" ? `${formatNumber(item.value, 2)}%` : fmtAster(item.value)}</strong>
            <p>{item.detail}</p>
            <a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.source}<ExternalLink size={12} /></a>
          </article>
        ))}
      </div>

      <div className="aster-supply-panel">
        <div className="aster-panel-heading">
          <div><span>SUPPLY MAP</span><h2>当前供应结构</h2></div>
          <strong>{formatNumber(dataset.metrics.circulatingRatio.value, 2)}% 已流通</strong>
        </div>
        <div className="supply-bar" aria-label="ASTER circulating supply ratio">
          <div style={{ width: `${Math.min(100, circulating / supply * 100)}%` }} />
        </div>
        <div className="supply-bar-labels">
          <span><b>{fmtAster(circulating)}</b> 市场流通口径</span>
          <span><b>{fmtAster(lockedOrReserved)}</b> 未流通 / 储备估算</span>
          <span><b>{fmtAster(dataset.metrics.cumulativeBurn.value)}</b> 累计销毁</span>
        </div>
      </div>

      <AsterPressureCharts dataset={dataset} />

      <div className="aster-two-column">
        <div className="aster-supply-panel">
          <div className="aster-panel-heading">
            <div><span>UNLOCK WATCH</span><h2>未来释放日历</h2></div>
            {nextUnlock ? <strong>下一项 {nextUnlock.date}</strong> : null}
          </div>
          <div className="unlock-list">
            {dataset.unlocks.map((item) => (
              <article className="unlock-row" key={`${item.date}-${item.category}`}>
                <time>{item.date}</time>
                <div>
                  <div><strong>{item.category}</strong><span className={`unlock-status ${item.status}`}>{item.status === "recurring" ? "周期排放" : item.status === "postponed" ? "已推迟" : "计划释放"}</span></div>
                  <b>{fmtAster(item.amount)} ASTER</b>
                  <p>{item.detail}</p>
                  <a href={item.sourceUrl} target="_blank" rel="noreferrer">查看依据 <ExternalLink size={12} /></a>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="aster-supply-panel buyback-panel">
          <div className="aster-panel-heading"><div><span>BUYBACK / BURN</span><h2>回购与销毁</h2></div></div>
          <div className="mechanism-flow">
            <div><span>平台日手续费</span><strong>99%</strong></div><b>→</b><div><span>TWAP 回购</span><strong>奖励 veASTER</strong></div><b>+</b><div><span>储备等量销毁</span><strong>降低总供应</strong></div>
          </div>
          {dataset.buybacks.map((item) => (
            <article className="buyback-record" key={item.endDate}>
              <div><span>{item.startDate} → {item.endDate}</span><b>最近披露周期</b></div>
              <dl><div><dt>回购</dt><dd>{fmtAster(item.bought)}</dd></div><div><dt>销毁</dt><dd>{fmtAster(item.burned)}</dd></div></dl>
              <p>{item.detail}</p>
              <a href={item.sourceUrl} target="_blank" rel="noreferrer">官方更新 <ExternalLink size={12} /></a>
            </article>
          ))}
          <div className="buyback-wallets">
            <a href="https://bscscan.com/address/0xa0edBaBcb48034e368de286b49F9603C7AfA1b60" target="_blank" rel="noreferrer"><span>公开回购钱包</span><strong>0xa0ed…1b60</strong></a>
            <a href="https://bscscan.com/address/0x39C473f4420e4ae9Ab3fe9e7ceDFc08F9684bB1a" target="_blank" rel="noreferrer"><span>上币费钱包</span><strong>0x39C4…bB1a</strong></a>
          </div>
        </div>
      </div>

      <div className="aster-supply-panel allocation-panel">
        <div className="aster-panel-heading"><div><span>GENESIS ALLOCATION</span><h2>初始 80 亿枚分配</h2></div></div>
        <div className="allocation-bar">{dataset.allocation.map((item) => <div key={item.label} style={{ background: item.color, width: `${item.percent}%` }} title={`${item.label} ${item.percent}%`} />)}</div>
        <div className="allocation-legend">{dataset.allocation.map((item) => <div key={item.label}><i style={{ background: item.color }} /><span>{item.label}</span><strong>{item.percent}%</strong><small>{fmtAster(item.amount)}</small></div>)}</div>
      </div>

      <div className="aster-notes">{dataset.notes.map((note) => <p key={note}>{note}</p>)}</div>
    </section>
  );
}

function AsterPressureCharts({ dataset }: { dataset: AsterDataset }) {
  const start = new Date("2026-09-01T00:00:00Z");
  const months = Array.from({ length: 19 }, (_, index) => {
    const date = new Date(start);
    date.setUTCMonth(date.getUTCMonth() + index);
    return date.toISOString().slice(0, 10);
  });
  const latestPeriod = dataset.buybacks[0];
  const dailyBuyback = latestPeriod
    ? latestPeriod.burned / Math.max(1, (Date.parse(latestPeriod.endDate) - Date.parse(latestPeriod.startDate)) / 86_400_000)
    : 0;
  let cumulativeUnlock = 0;
  let cumulativeBurn = 0;
  const monthlyUnlocks: DataPoint[] = [];
  const monthlyBuyback: DataPoint[] = [];
  const unlockCurve: DataPoint[] = [];
  const burnCurve: DataPoint[] = [];
  const netCurve: DataPoint[] = [];

  months.forEach((date, index) => {
    const monthStart = new Date(`${date}T00:00:00Z`);
    const monthEnd = new Date(monthStart);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
    const days = (monthEnd.getTime() - monthStart.getTime()) / 86_400_000;
    const recurringEmission = (450_000 / 7) * days;
    const teamMonthlyUnlock = date >= "2027-10-01" ? 10_000_000 : 0;
    const datedUnlocks = dataset.unlocks
      .filter((item) => item.status !== "recurring" && item.date >= date && item.date < monthEnd.toISOString().slice(0, 10))
      .reduce((sum, item) => sum + item.amount, 0);
    const monthUnlock = recurringEmission + datedUnlocks + teamMonthlyUnlock;
    const monthBurn = dailyBuyback * days;
    if (index > 0) {
      cumulativeUnlock += monthUnlock;
      cumulativeBurn += monthBurn;
    }
    monthlyUnlocks.push({ date, value: monthUnlock / 1_000_000 });
    monthlyBuyback.push({ date, value: monthBurn / 1_000_000 });
    unlockCurve.push({ date, value: cumulativeUnlock / 1_000_000 });
    burnCurve.push({ date, value: cumulativeBurn / 1_000_000 });
    netCurve.push({ date, value: (cumulativeUnlock - cumulativeBurn) / 1_000_000 });
  });

  const dateRange = { start: months[0], end: months.at(-1) ?? months[0] };
  const projectedMonthlyBurn = monthlyBuyback[1]?.value ?? 0;
  return (
    <div className="aster-chart-grid">
      <section className="aster-supply-panel aster-chart-card">
        <div className="aster-panel-heading">
          <div><span>18-MONTH SCENARIO</span><h2>累计供应压力与销毁对冲</h2></div>
          <strong>单位：百万 ASTER</strong>
        </div>
        <MultiLineChart
          dateRange={dateRange}
          fixedRange
          height={300}
          series={[
            { label: "计划新增供应", color: "#f59e0b", points: unlockCurve },
            { label: "销毁对冲（情景）", color: "#0f766e", points: burnCurve },
            { label: "净供应压力", color: "#dc2626", points: netCurve }
          ]}
          valueLabel="ASTER 累计供应压力情景"
        />
        <p className="chart-method">橙线包含当前每周 45 万枚质押排放、已披露空投领取与延期后的团队月度解锁；绿线假设最近 14 天销毁速度保持不变。红线为两者之差，不是价格预测。</p>
      </section>
      <section className="aster-supply-panel aster-chart-card">
        <div className="aster-panel-heading">
          <div><span>MONTHLY FORCE</span><h2>月度新增供应 vs 回购力度</h2></div>
          <strong>当前速度约 {formatNumber(projectedMonthlyBurn, 2)}M/月</strong>
        </div>
        <MultiLineChart
          dateRange={dateRange}
          fixedRange
          height={300}
          series={[
            { label: "当月计划释放", color: "#f59e0b", points: monthlyUnlocks },
            { label: "回购 / 等量销毁情景", color: "#2563eb", points: monthlyBuyback }
          ]}
          valueLabel="ASTER 月度供需力度情景"
        />
        <p className="chart-method">尖峰对应集中领取或团队归属开始。蓝线按最近披露周期年化，仅用于回答“当前回购力度能否覆盖计划释放”，实际回购会随平台手续费变化。</p>
      </section>
    </div>
  );
}

function UpcomingEvents({ events }: { events: UpcomingEvent[] }) {
  const formatEventDate = (event: UpcomingEvent) => {
    const start = new Date(`${event.date}T00:00:00+08:00`);
    const startText = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", weekday: "short" }).format(start);
    if (!event.endDate || event.endDate === event.date) return startText;
    const end = new Date(`${event.endDate}T00:00:00+08:00`);
    return `${startText}–${new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(end)}`;
  };

  const daysUntil = (date: string) => {
    const target = new Date(`${date}T00:00:00+08:00`).getTime();
    const current = new Date();
    const todayStart = new Date(current.getFullYear(), current.getMonth(), current.getDate()).getTime();
    const days = Math.max(0, Math.ceil((target - todayStart) / 86_400_000));
    return days === 0 ? "今天" : `${days}天后`;
  };

  return (
    <section className="upcoming-events" aria-labelledby="upcoming-events-title">
      <div className="events-heading">
        <div>
          <span>官方日历 · 自动更新</span>
          <h2 id="upcoming-events-title">哪些事件可能改变流动性方向？</h2>
        </div>
        <CalendarClock size={24} />
      </div>
      <div className="event-grid">
        {events.slice(0, 6).map((event) => (
          <article className={`event-card importance-${event.importance}`} key={event.id}>
            <div className="event-date">
              <strong>{formatEventDate(event)}</strong>
              <span>{daysUntil(event.date)}</span>
            </div>
            <div className="event-tags">
              <span>{event.region}</span>
              <span>{event.category}</span>
            </div>
            <h3>{event.title}</h3>
            <p>{event.detail}</p>
            <a href={event.sourceUrl} rel="noreferrer" target="_blank">
              {event.source}
              <ExternalLink size={14} />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

function CuratedLiquidityDetail({
  dataset,
  id,
  keys
}: {
  dataset: LiquidityDataset;
  id: string;
  keys: string[];
}) {
  const snapshots = new Map(dataset.snapshots.map((snapshot) => [snapshot.key, snapshot]));
  const definitions = keys
    .map((key) => dataset.indicators.find((definition) => definition.key === key))
    .filter((definition): definition is IndicatorDefinition => Boolean(definition));

  return (
    <section className="curated-detail" id={id}>
      <div className="curated-snapshot-grid">
        {definitions.map((definition) => {
          const snapshot = snapshots.get(definition.key);
          return snapshot ? (
            <div key={definition.key}>
              <span>{definition.shortName}</span>
              <strong>{formatNumber(snapshot.latestValue, 2)}</strong>
              <small>{definition.unit}</small>
            </div>
          ) : null;
        })}
      </div>
      <div className="curated-chart-grid">
        {definitions.map((definition) => {
          const snapshot = snapshots.get(definition.key);
          return snapshot ? (
            <IndicatorChart
              key={definition.key}
              definition={definition}
              snapshot={snapshot}
              dateRange={dataset.dateRange}
            />
          ) : null;
        })}
      </div>
    </section>
  );
}

function CuratedTreasuryDetail({ dataset }: { dataset: LiquidityDataset }) {
  const selectedTitles = new Set(["市场需要吸收多少美国国债？", "高利率正在多快传导至财政？", "期限溢价是否正在推高长端利率？"]);
  const charts = (dataset.treasuryCharts ?? []).filter((chart) => selectedTitles.has(chart.title));
  return (
    <div id="treasury-details">
      <TreasuryMarketTerminal
        charts={charts}
        dateRange={dataset.dateRange}
        foreignHolderShares={[]}
        holderShares={dataset.holderShares ?? []}
        notes={[]}
      />
    </div>
  );
}

function AnalysisDisclosure({
  children,
  description,
  title
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <details className="analysis-disclosure">
      <summary>
        <span>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        <b aria-hidden="true">展开</b>
      </summary>
      <div className="analysis-disclosure-content">{children}</div>
    </details>
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

function LiquidityRateOverview({
  dateRange,
  inflationCharts,
  rateCharts
}: {
  dateRange: LiquidityDataset["dateRange"];
  inflationCharts: InterestRateChart[];
  rateCharts: InterestRateChart[];
}) {
  const charts = [...rateCharts, ...inflationCharts];
  return (
    <section className="rate-section liquidity-rate-overview">
      <div className="compact-section-heading">
        <div>
          <span>RATE REGIME</span>
          <h2>利率环境是否正在转向？</h2>
        </div>
        <p>名义资金成本与实际利率共同决定现金吸引力和风险资产估值压力。</p>
      </div>
      <div className="liquidity-rate-grid">
        {charts.map((chart) => (
          <article className="compact-rate-card" key={chart.title}>
            <div className="compact-rate-header">
              <div><span>{chart === rateCharts[0] ? "POLICY RATE" : "REAL RATE"}</span><h3>{chart.title}</h3></div>
              <p>{chart.description}</p>
            </div>
            <MultiLineChart series={chart.series} dateRange={dateRange} height={210} valueLabel={chart.title} />
            <div className="compact-rate-sources">
              {chart.series.map((item) => {
                const latest = item.points.at(-1);
                return (
                  <a href={item.sourceUrl} key={item.key} target="_blank" rel="noreferrer">
                    <i style={{ background: item.color }} />
                    <span>{item.label}</span>
                    <strong>{latest ? `${formatNumber(latest.value, 2)}${item.unit}` : "n/a"}</strong>
                  </a>
                );
              })}
            </div>
          </article>
        ))}
      </div>
      {inflationCharts.length > 0 ? (
        <AnalysisDisclosure title="如何理解名义利率与实际利率" description="展开查看现金收益、通胀和风险资产估值之间的关系。">
          <RealRateImpactPanel charts={inflationCharts} />
        </AnalysisDisclosure>
      ) : null}
    </section>
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
        <h2>政策利率正在走向宽松还是收紧？</h2>
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
        <h3>现金的实际回报是否仍在压制风险资产？</h3>
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
  dateRange
}: {
  charts: InterestRateChart[];
  dateRange: LiquidityDataset["dateRange"];
}) {
  const assets = charts.flatMap((chart) =>
    chart.series.map((series) => {
      const thirteenWeek = percentChangeSeries(series.points, 91).at(-1)?.value ?? null;
      const oneYear = percentChangeSeries(series.points, 365).at(-1)?.value ?? null;
      return { chart, series, thirteenWeek, oneYear };
    })
  );
  const positiveBreadth = assets.filter((asset) => (asset.thirteenWeek ?? 0) > 0).length;
  const comparisonSeries = assets.map(({ series }, index) => ({
    label: riskAssetLabel(series.label),
    color: ["#f59e0b", "#2563eb", "#16a34a"][index] ?? series.color,
    points: series.points
  }));

  return (
    <section className="terminal risk-dashboard" id="terminal">
      <div className="dashboard-hero risk-dashboard-hero">
        <div>
          <span>13周上涨</span>
          <strong>{positiveBreadth}/{assets.length}</strong>
          <p>{riskBreadthText(positiveBreadth, assets.length)}</p>
        </div>
        <div className="dashboard-rule">
          <b>确认规则</b>
          <p>三项同步上涨说明风险偏好具有广度；只有 BTC 单独走强或港科持续落后时，不能视为全球风险流动性全面改善。</p>
        </div>
      </div>
      <div className="risk-momentum-grid">
        {assets.map(({ series, thirteenWeek, oneYear }) => (
          <div className="risk-momentum-card" key={series.key}>
            <span>{riskAssetLabel(series.label)}</span>
            <strong>{formatSignedPercent(thirteenWeek)}</strong>
            <b>{riskMomentumText(thirteenWeek)}</b>
            <p>13周 · 1年 {formatSignedPercent(oneYear)}</p>
          </div>
        ))}
      </div>
      <div className="charts-stack">
        <section className="chart-panel">
          <div className="chart-header">
            <div>
              <span>Risk Breadth / Log Return</span>
              <h3>上涨是否扩散到多个风险市场？</h3>
            </div>
          </div>
          <MultiLineChart
            series={comparisonSeries}
            dateRange={dateRange}
            transform="log-return"
            valueLabel="累计对数收益率（%）"
          />
          <div className="interpretation">
            <strong>当前解读</strong>
            <p>三项从所选窗口内的共同首个交易日统一归零，再计算累计对数收益率，比较方向、拐点和相对强弱。</p>
          </div>
        </section>
        <AnalysisDisclosure title="查看单资产原始曲线" description="按各自纵轴查看价格路径、最新值与官方数据源。">
          <div className="risk-detail-grid">
            {charts.map((chart) => (
              <section className="chart-panel" key={chart.title}>
                <div className="chart-header">
                  <div>
                    <span>Normalized Price</span>
                    <h3>{chart.title}</h3>
                  </div>
                </div>
                <MultiLineChart series={chart.series} dateRange={dateRange} valueLabel={chart.title} />
                <div className="rate-sources">
                  {chart.series.map((item) => {
                    const latest = item.points.at(-1);
                    return (
                      <a href={item.sourceUrl} key={item.key} target="_blank" rel="noreferrer">
                        <strong>{riskAssetLabel(item.label)}</strong>
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
        </AnalysisDisclosure>
      </div>
    </section>
  );
}

function riskAssetLabel(label: string) {
  if (label.includes("纳斯达克")) return "Nasdaq";
  if (label.includes("恒生科技")) return "HSTECH 代理";
  return label;
}

function formatSignedPercent(value: number | null) {
  if (value === null) return "n/a";
  return `${value > 0 ? "+" : ""}${formatNumber(value, 1)}%`;
}

function riskMomentumText(value: number | null) {
  if (value === null) return "数据不足";
  if (value >= 10) return "强势";
  if (value > 0) return "上涨";
  if (value > -5) return "震荡";
  return "走弱";
}

function riskBreadthText(positive: number, total: number) {
  if (total === 0) return "数据不足";
  if (positive === total) return "风险偏好同步扩张";
  if (positive >= 2) return "风险偏好有一定广度";
  if (positive === 1) return "局部上涨，尚未形成共振";
  return "风险偏好同步收缩";
}

function CapexTerminal({ dataset }: { dataset: LiquidityDataset }) {
  const growthChart = dataset.capexCharts?.[0];
  const absoluteChart = dataset.capexCharts?.[1];
  const metrics = dataset.capexCompanyMetrics ?? [];
  const totalCapex = metrics.reduce((sum, item) => sum + item.ttmCapex, 0);
  const totalOperatingCashFlow = metrics.reduce((sum, item) => sum + item.ttmOperatingCashFlow, 0);
  const previousTotal = metrics.reduce((sum, item) => {
    if (item.capexGrowthYoy === null) return sum;
    return sum + item.ttmCapex / (1 + item.capexGrowthYoy / 100);
  }, 0);
  const aggregateGrowth = previousTotal > 0 ? ((totalCapex / previousTotal) - 1) * 100 : null;
  const aggregateCoverage = totalCapex > 0 ? totalOperatingCashFlow / totalCapex : null;
  const commitments = dataset.capexCommitments ?? [];

  return (
    <section className="terminal capex-dashboard" id="terminal">
      <div className="dashboard-hero capex-dashboard-hero">
        <div>
          <span>四大厂商 TTM CapEx 增速</span>
          <strong>{formatSignedPercent(aggregateGrowth)}</strong>
          <p>截至 {metrics[0]?.asOf?.slice(0, 7) ?? "数据不足"}</p>
        </div>
        <div className="dashboard-rule">
          <b>增长可持续性</b>
          <p>经营现金流对现金 CapEx 的整体覆盖倍数为 <strong>{aggregateCoverage === null ? "n/a" : `${formatNumber(aggregateCoverage, 2)}x`}</strong>。覆盖率与自由现金流比绝对支出更能判断扩张是否依赖融资。</p>
        </div>
      </div>
      <div className="capex-component-grid">
        {metrics.map((item) => <CapexCompanyCard item={item} key={item.key} />)}
      </div>
      {growthChart ? (
        <div className="capex-chart-grid capex-chart-primary">
          <section className="chart-panel">
            <div className="chart-header">
              <div>
                <span>Growth / Rolling Four Quarters</span>
                <h3>资本开支是在加速还是降温？</h3>
              </div>
            </div>
            <MultiLineChart series={growthChart.series} dateRange={dataset.dateRange} valueLabel="TTM CapEx 同比增速" />
          </section>
        </div>
      ) : null}
      {commitments.length > 0 ? (
        <AnalysisDisclosure title="查看远期投资承诺" description="承诺不是实际支出，也不直接构成股票或供应链公司的盈利信号。">
          <CapexCommitments commitments={commitments} />
        </AnalysisDisclosure>
      ) : null}
      {absoluteChart ? (
        <AnalysisDisclosure title="查看季度绝对支出" description="绝对金额作为辅助数据，用于核对各公司的季度现金投入节奏。">
          <section className="chart-panel">
            <MultiLineChart series={absoluteChart.series} dateRange={dataset.dateRange} valueLabel={absoluteChart.title} />
          </section>
        </AnalysisDisclosure>
      ) : null}
    </section>
  );
}

function CapexCompanyCard({ item }: { item: AiCapexCompanyMetrics }) {
  return (
    <div className="capex-component-card">
      <span>{item.label} · TTM CapEx 增速</span>
      <strong>{formatSignedPercent(item.capexGrowthYoy)}</strong>
      <b>{item.financingStatus}</b>
      <dl>
        <div><dt>自由现金流</dt><dd>{formatNumber(item.ttmFreeCashFlow, 1)}B</dd></div>
        <div><dt>现金覆盖</dt><dd>{item.cashCoverageRatio === null ? "n/a" : `${formatNumber(item.cashCoverageRatio, 2)}x`}</dd></div>
        <div><dt>TTM CapEx</dt><dd>{formatNumber(item.ttmCapex, 1)}B</dd></div>
      </dl>
    </div>
  );
}

function CapexCommitments({ commitments }: { commitments: AiCapexCommitment[] }) {
  return (
    <section className="capex-commitments">
      <div className="chart-header">
        <div>
          <span>Guidance / Announced Commitments</span>
          <h3>远期投资承诺能否转化为真实订单？</h3>
        </div>
      </div>
      <div className="commitment-list">
        {commitments.map((item) => (
          <a href={item.sourceUrl} key={item.name} rel="noreferrer" target="_blank">
            <div>
              <span>{item.type} · {item.horizon}</span>
              <strong>{item.name}</strong>
            </div>
            <b>{item.amount}</b>
            <p>{item.detail}</p>
          </a>
        ))}
      </div>
      <p className="commitment-warning">承诺金额具有不同币种、周期和执行条件，不与季度实际 CapEx 相加。</p>
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
  const decisionCharts = charts.filter((chart) =>
    chart.series.some((series) => ["dgs3mo", "dgs2", "dgs10", "dgs30", "t10y2y"].includes(series.key))
  );
  const contextCharts = charts.filter((chart) => !decisionCharts.includes(chart));
  return (
    <section className="terminal" id="terminal">
      <div className="section-heading">
        <h2>利率曲线是否正在收紧风险资产估值？</h2>
      </div>
      <div className="treasury-core-grid">
        {decisionCharts.map((chart) => (
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
      <AnalysisDisclosure title="查看美债结构背景" description="债务存量和持有人结构变化缓慢，不作为短周期买卖信号。">
        <div className="treasury-core-grid">
          {holderShares.length > 0 ? (
            <HolderSharePanel
              description="持有人结构用于判断长期承接基础，但托管口径不能代表边际买盘。"
              eyebrow="Ownership Structure"
              shares={holderShares}
              title="美债持有人份额"
            />
          ) : null}
          {foreignHolderShares.length > 0 ? (
            <HolderSharePanel
              description="TIC 按托管或报告地统计，不一定等于最终受益所有人，因此只作背景参考。"
              eyebrow="Foreign Holders"
              shares={foreignHolderShares}
              title="海外主要持有人细分"
            />
          ) : null}
          {contextCharts.map((chart) => (
            <section className="chart-panel" key={chart.title}>
              <div className="chart-header"><div><span>Slow-moving context</span><h3>{chart.title}</h3></div></div>
              <MultiLineChart series={chart.series} dateRange={dateRange} valueLabel={chart.title} />
              <div className="interpretation"><strong>仅作背景</strong><p>{chart.description}</p></div>
            </section>
          ))}
        </div>
      </AnalysisDisclosure>
      <div className="notes risk-notes">
        {notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </div>
    </section>
  );
}

const costCategoryLabels: Record<string, string> = {
  cash: "现金",
  ust: "美债",
  credit: "信用",
  fx: "海外/汇率",
  equity: "股票"
};

const costCategoryTitles: Record<string, string> = {
  cash: "现金与货币市场",
  ust: "美债收益率曲线",
  credit: "信用债总收益",
  fx: "海外债券（美元折算）",
  equity: "股票"
};

const anchorBarShortLabels: Record<string, string> = {
  sofr: "SOFR",
  dgs3mo: "3M",
  dgs2: "2Y",
  dgs10: "10Y",
  dgs30: "30Y",
  dfii10: "10Y实际",
  igTotal: "IG总",
  hyTotal: "HY总",
  spxEarningsYield: "标普盈利"
};

function CostOfCapitalTerminal({ dataset }: { dataset: LiquidityDataset }) {
  const cost = dataset.costOfCapital;
  if (!cost) {
    return (
      <section className="terminal" id="terminal">
        <div className="section-heading">
          <h2>美元现金收益是否仍具吸引力？</h2>
        </div>
        <div className="notes risk-notes">
          <p>数据尚未生成。请先运行数据更新脚本，再重新构建页面。</p>
        </div>
      </section>
    );
  }

  const decisionYieldKeys = new Set(["effr", "dgs3mo", "dgs2", "dgs10", "dgs30", "dfii10", "igTotal", "hyTotal", "spxEarningsYield"]);
  const decisionSpreadKeys = new Set(["equityBondGap", "t10y2y", "igOas", "hyOas", "broadDollar"]);
  const { anchor } = cost;
  const yields = cost.yields.filter((item) => decisionYieldKeys.has(item.key));
  const spreads = cost.spreads.filter((item) => decisionSpreadKeys.has(item.key));
  const charts = cost.charts.filter((chart) => !chart.series.some((series) => ["jgbUsd", "bundUsd"].includes(series.key)));
  const byKey = new Map(yields.map((item) => [item.key, item]));
  const seriesByKey = new Map<string, DataPoint[]>();
  charts.forEach((chart) =>
    chart.series.forEach((series) => {
      if (!seriesByKey.has(series.key)) seriesByKey.set(series.key, series.points);
    })
  );
  const categoryOrder = ["cash", "ust", "credit", "equity"];

  return (
    <section className="terminal cost-dashboard" id="terminal">
      <div className="section-heading">
        <p>Cost of Capital / USD Rate Anchor</p>
        <h2>风险资产需要跨过多高的收益门槛？</h2>
      </div>

      <div className="cost-hero">
        <div className="cost-hero-anchor">
          <span>美元现金锚 · EFFR</span>
          <strong>{formatNumber(anchor.latestValue, 3)}%</strong>
          <p>{anchor.latestDate}</p>
          <dl className="cost-anchor-stats">
            <div>
              <dt>SOFR</dt>
              <dd>{formatNumber(byKey.get("sofr")?.latestValue ?? null, 2)}%</dd>
            </div>
            <div>
              <dt>3M 美债</dt>
              <dd>{formatNumber(byKey.get("dgs3mo")?.latestValue ?? null, 2)}%</dd>
            </div>
            <div>
              <dt>十年位置</dt>
              <dd>{anchor.percentile === null ? "n/a" : `${Math.round(anchor.percentile)}%`}</dd>
            </div>
            <div>
              <dt>1M 变化</dt>
              <dd>{formatChange(anchor.oneMonthChange, 2)}%</dd>
            </div>
          </dl>
        </div>
        <div className="cost-anchor-bars">
          <div className="cost-bars-heading">
            <span>各收益载体相对现金锚的利差（bp）</span>
            <b>正值为跑赢现金锚</b>
          </div>
          <AnchorBars yields={yields} />
        </div>
        <div className="cost-rule">
          <b>怎么读</b>
          <p>{anchor.description}</p>
          <p>条形图回答“谁跑赢了现金”：柱子在 0 线右侧表示收益高于 EFFR，左侧表示低于现金锚。收益率上行通常代表资金撤出该市场或供给压力，下行代表价格走强。</p>
        </div>
      </div>

      <div className="section-heading">
        <p>Unified Yield Ladder</p>
        <h2>各类资产能提供多少美元年化收益？</h2>
      </div>
      <div className="cost-ladder-grid">
        {categoryOrder.flatMap((category) => [
          <div className="cost-group-heading" key={`group-${category}`}>
            <span>{costCategoryTitles[category]}</span>
            <small>{yields.filter((item) => item.category === category).length} 项</small>
          </div>,
          ...yields
            .filter((item) => item.category === category)
            .map((item) => (
              <CostYieldCard item={item} key={item.key} points={seriesByKey.get(item.key) ?? []} />
            ))
        ])}
      </div>

      <div className="section-heading">
        <p>Relative Value Signals</p>
        <h2>哪些风险溢价正在扩大或收窄？</h2>
      </div>
      <div className="cost-spread-grid">
        {spreads.map((item) => (
          <CostSpreadCard item={item} key={item.key} />
        ))}
      </div>

      <div className="section-heading">
        <p>Yield History</p>
        <h2>资金价格的趋势是否发生转向？</h2>
      </div>
      <div className="charts-stack">
        {charts.map((chart) => (
          <section className="chart-panel" key={chart.title}>
            <div className="chart-header">
              <div>
                <span>Cost of Capital</span>
                <h3>{chart.title}</h3>
              </div>
            </div>
            <MultiLineChart series={chart.series} dateRange={dataset.dateRange} valueLabel={chart.title} />
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
        {dataset.notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </div>
    </section>
  );
}

function CostYieldCard({ item, points }: { item: CostOfCapitalYield; points: DataPoint[] }) {
  const change = (value: number | null) => (value === null ? "n/a" : `${formatChange(value, 2)}%`);
  return (
    <section className="cost-ladder-card">
      <div className="cost-card-top">
        <div>
          <span className="cost-card-category">{costCategoryLabels[item.category] ?? item.category}</span>
          <h3>{item.label}</h3>
        </div>
        <div className="cost-card-value">
          <strong>{item.latestValue === null ? "n/a" : `${formatNumber(item.latestValue, 2)}%`}</strong>
          <span>{item.basis}</span>
        </div>
      </div>
      <div className="cost-card-deltas">
        <span className={item.vsAnchorBp === null ? "" : item.vsAnchorBp >= 0 ? "cost-positive" : "cost-negative"}>
          {item.key === "effr" ? "基准" : item.vsAnchorBp === null ? "—" : `vs 锚 ${formatChange(item.vsAnchorBp, 0)}bp`}
        </span>
        <span>1M {change(item.oneMonthChange)}</span>
        <span>3M {change(item.threeMonthChange)}</span>
        <span>6M {change(item.sixMonthChange)}</span>
      </div>
      <Sparkline points={points} />
      {item.fxContribution !== undefined ? (
        <p className="cost-card-extra">
          汇率 12M {item.fxMove === null ? "n/a" : `${formatChange(item.fxMove, 2)}%`}
          {" · "}折算贡献 {item.fxContribution === null ? "n/a" : `${formatChange(item.fxContribution, 2)}%`}
          {" · "}本币 {item.localYield === null ? "n/a" : `${formatNumber(item.localYield, 2)}%`}
        </p>
      ) : null}
      {item.peRatio !== undefined ? (
        <p className="cost-card-extra">Shiller PE {item.peRatio === null ? "n/a" : formatNumber(item.peRatio, 1)}</p>
      ) : null}
      <div className="cost-card-meta">
        <a href={item.sourceUrl} target="_blank" rel="noreferrer">
          {item.source}
        </a>
        <span>{item.latestDate}</span>
      </div>
    </section>
  );
}

function AnchorBars({ yields }: { yields: CostOfCapitalYield[] }) {
  const items = Object.keys(anchorBarShortLabels)
    .map((key) => yields.find((item) => item.key === key))
    .filter((item): item is CostOfCapitalYield => Boolean(item && item.vsAnchorBp !== null));
  const maxAbs = Math.max(...items.map((item) => Math.abs(item.vsAnchorBp ?? 0)), 1);
  const scale = Math.ceil(maxAbs / 100) * 100;
  return (
    <div className="cost-bars">
      {items.map((item) => {
        const bp = item.vsAnchorBp ?? 0;
        const width = Math.min((Math.abs(bp) / scale) * 50, 50);
        const style: CSSProperties = { width: `${width}%` };
        if (bp >= 0) style.left = "50%";
        else style.right = "50%";
        return (
          <div className="cost-bar-row" key={item.key}>
            <span className="cost-bar-label">{anchorBarShortLabels[item.key]}</span>
            <div className="cost-bar-track">
              <span className="cost-bar-center" />
              <span className={`cost-bar-fill ${bp >= 0 ? "positive" : "negative"}`} style={style} />
            </div>
            <span className="cost-bar-value">{bp >= 0 ? "+" : ""}{bp}</span>
          </div>
        );
      })}
      <div className="cost-bar-scale">
        <span>-{scale}</span>
        <span>0</span>
        <span>+{scale}</span>
      </div>
    </div>
  );
}

function Sparkline({ points, height = 46 }: { points: DataPoint[]; height?: number }) {
  const width = 360;
  const padding = 3;
  const recent = points.slice(-780);
  if (recent.length === 0) {
    return <div className="sparkline-empty">暂无历史</div>;
  }
  const maxPoints = 150;
  const sampled =
    recent.length > maxPoints
      ? recent.filter((_, index) => index % Math.ceil(recent.length / maxPoints) === 0)
      : recent;
  const values = sampled.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = (width - padding * 2) / Math.max(sampled.length - 1, 1);
  const path = sampled
    .map((point, index) => {
      const x = padding + index * step;
      const y = padding + (1 - (point.value - min) / range) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = (sampled.at(-1)?.value ?? 0) >= (sampled[0]?.value ?? 0);
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path
        d={path}
        fill="none"
        stroke={up ? "#0f766e" : "#dc2626"}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function CostSpreadCard({ item }: { item: CostOfCapitalSpread }) {
  const unit = item.unit === "点" ? "点" : item.unit;
  return (
    <section className="cost-spread-card">
      <span>{item.label}</span>
      <strong>{item.latestValue === null ? "n/a" : `${formatNumber(item.latestValue, 2)}${unit}`}</strong>
      <p>
        1M {formatChange(item.oneMonthChange, 2)}{unit} · 3M {formatChange(item.threeMonthChange, 2)}{unit}
      </p>
      <p>{item.description}</p>
      <div className="cost-card-meta">
        <a href={item.sourceUrl} target="_blank" rel="noreferrer">
          {item.source}
        </a>
        <span>{item.latestDate}</span>
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
  const sofrIorb = usdMap.get("sofrIorb")?.series ?? [];
  const hyOas = usdMap.get("hyOas")?.series ?? [];
  const broadDollar = usdMap.get("broadDollar")?.series ?? [];
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
        <h2>流动性是在改善，还是仅仅维持高位？</h2>
      </div>
      <div className="overlay-note">
        存量决定水位，变化量决定方向，变化率的变化决定拐点。数量流动性和融资条件统一转换为 4W、13W、26W 动量，重点识别风险资产的边际顺风或逆风。
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
              <h3>美元净流动性正在加速还是减速？</h3>
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
              <h3>主要货币水位是否同步扩张？</h3>
            </div>
          </div>
          <MultiLineChart series={quantityMomentum} dateRange={usd.dateRange} valueLabel="数量流动性 13周增速" />
          <div className="interpretation">
            <strong>当前解读</strong>
          <p>Fed 净流动性、Fed 与 BOJ 资产及两国 M2 均转换为 13 周增速；同向上升代表货币水位形成共振，分化则意味着改善并不全面。</p>
          </div>
        </section>
        <section className="chart-panel">
          <div className="chart-header">
            <div>
              <span>Funding Momentum</span>
              <h3>融资市场是否为风险资产提供顺风？</h3>
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

function YenCarryStressTerminal({
  jpy,
  treasury,
  usd
}: {
  jpy: LiquidityDataset;
  treasury: LiquidityDataset;
  usd: LiquidityDataset;
}) {
  const jpyMap = new Map(jpy.snapshots.map((item) => [item.key, item]));
  const usdEffr = usd.rateCharts?.flatMap((chart) => chart.series).find((item) => item.key === "effr");
  const jpyCallAverage = jpy.rateCharts
    ?.flatMap((chart) => chart.series)
    .find((item) => item.key === "jpyCallAverage");
  const dgs10 = treasury.treasuryCharts?.flatMap((chart) => chart.series).find((item) => item.key === "dgs10");
  const dgs30 = treasury.treasuryCharts?.flatMap((chart) => chart.series).find((item) => item.key === "dgs30");
  const rateSpread = usdEffr && jpyCallAverage ? spreadSeries(usdEffr.points, jpyCallAverage.points) : [];
  const usdJpy = jpyMap.get("usdJpy")?.series ?? [];
  const jgb10y = jpyMap.get("jgb10y")?.series ?? [];
  const jpyCall = jpyCallAverage?.points ?? [];

  const stressComponents = standardizeSeries([
    { label: "美日利差收窄", color: "#2563eb", points: invertSeries(absoluteChangeSeries(rateSpread, 91)) },
    { label: "日元升值", color: "#16a34a", points: invertSeries(percentChangeSeries(usdJpy, 91)) },
    { label: "JGB上行", color: "#dc2626", points: absoluteChangeSeries(jgb10y, 91) },
    { label: "US10Y上行", color: "#7c3aed", points: absoluteChangeSeries(dgs10?.points ?? [], 91) },
    { label: "US30Y上行", color: "#f59e0b", points: absoluteChangeSeries(dgs30?.points ?? [], 91) },
    { label: "BOJ隔夜利率上行", color: "#0f766e", points: absoluteChangeSeries(jpyCall, 91) }
  ]);
  const stressIndex = averageAlignedSeries(stressComponents);
  const latestStress = stressIndex.at(-1)?.value;

  const carrySignals = [
    carrySignal("当前美日隔夜利差", rateSpread.at(-1)?.value, "pct", false),
    carrySignal("美日利差 13W", absoluteChangeSeries(rateSpread, 91).at(-1)?.value, "pct", false),
    carrySignal("USDJPY 13W", percentChangeSeries(usdJpy, 91).at(-1)?.value, "%", false),
    carrySignal("Carry压力指数", latestStress, "z", true)
  ];

  return (
    <section className="terminal">
      <div className="section-heading">
        <p>Yen Carry Stress</p>
        <h2>日元套息交易是否接近反转？</h2>
      </div>
      <div className="overlay-note">
        这里衡量的是日元融资套利的市场压力代理，不是完整资金规模。CFTC 可看期货拥挤度，BIS 可看中长期日元融资规模；本页先用更高频的利差、汇率、JGB 和美债长端收益率观察 unwind 风险。
      </div>
      <div className="momentum-summary">
        {carrySignals.map((signal) => (
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
              <span>Carry Return Base</span>
              <h3>借入日元的收益空间还有多大？</h3>
            </div>
          </div>
          <MultiLineChart
            dateRange={usd.dateRange}
            series={[
              { label: "美日隔夜利差", color: "#2563eb", points: rateSpread },
              { label: "USDJPY 13W%", color: "#16a34a", points: percentChangeSeries(usdJpy, 91) }
            ]}
            valueLabel="日元融资套利基础"
          />
          <div className="interpretation">
            <strong>当前解读</strong>
            <p>
              美日利差代表 carry 收益基础，USDJPY 代表汇率方向。如果利差收窄且日元升值，carry trade 的收益和本金两端都会恶化。
            </p>
          </div>
        </section>
        <section className="chart-panel">
          <div className="chart-header">
            <div>
              <span>Unwind Pressure</span>
              <h3>平仓压力是否正在累积？</h3>
            </div>
            <div className="latest-value">
              <strong>{formatNumber(latestStress, 2)}</strong>
              <small>z</small>
            </div>
          </div>
          <LineChart series={stressIndex} color="#dc2626" dateRange={usd.dateRange} valueLabel="Carry Unwind 压力指数" />
          <div className="interpretation">
            <strong>当前解读</strong>
            <p>
              指数越高，代表日元融资 carry 的 unwind 压力越大：美日利差收窄、日元升值、JGB 上行、美国长端利率上行、BOJ 隔夜利率上行都会推高压力。
            </p>
          </div>
        </section>
        <section className="chart-panel">
          <div className="chart-header">
            <div>
              <span>Stress Components</span>
              <h3>压力来自汇率、利差还是长端利率？</h3>
            </div>
          </div>
          <MultiLineChart series={stressComponents} dateRange={usd.dateRange} valueLabel="Carry 压力分项" />
          <div className="interpretation">
            <strong>当前解读</strong>
            <p>
              分项全部方向化并标准化，向上都是 carry 压力上升。这样可以区分是利差压缩、日元升值、JGB 上行，还是美元长端收益率上行在主导压力。
            </p>
          </div>
        </section>
      </div>
    </section>
  );
}

function carrySignal(label: string, rawValue: number | undefined, unit: string, higherIsStress: boolean) {
  if (rawValue === undefined) {
    return { label, value: "n/a", text: "数据不足，暂不判断。" };
  }
  const value = `${rawValue > 0 ? "+" : ""}${formatNumber(rawValue, 2)}${unit}`;
  const stressText = rawValue > 0 ? "压力上升。" : rawValue < 0 ? "压力下降。" : "压力中性。";
  const tailwindText = rawValue > 0 ? "carry 顺风。" : rawValue < 0 ? "carry 逆风。" : "carry 中性。";
  return { label, value, text: higherIsStress ? stressText : tailwindText };
}

function GlobalLiquidityDashboard({
  jpy,
  risk,
  treasury,
  usd,
  upcomingEvents
}: {
  jpy: LiquidityDataset;
  risk: LiquidityDataset;
  treasury: LiquidityDataset;
  usd: LiquidityDataset;
  upcomingEvents: UpcomingEvent[];
}) {
  const usdMap = new Map(usd.snapshots.map((item) => [item.key, item]));
  const jpyMap = new Map(jpy.snapshots.map((item) => [item.key, item]));
  const usdEffr = findSeries(usd.rateCharts, "effr");
  const jpyCallAverage = findSeries(jpy.rateCharts, "jpyCallAverage");
  const usCpi = findSeries(usd.inflationCharts, "usCpiYoy");
  const dgs2 = findSeries(treasury.treasuryCharts, "dgs2");
  const dgs10 = findSeries(treasury.treasuryCharts, "dgs10");
  const dgs30 = findSeries(treasury.treasuryCharts, "dgs30");
  const btc = findSeries(risk.riskCharts, "btc");
  const nasdaq = findSeries(risk.riskCharts, "nasdaq");
  const hangSengTech = findSeries(risk.riskCharts, "hangSengTech");

  const netLiquidity = usdMap.get("netLiquidity")?.series ?? [];
  const sofrIorb = usdMap.get("sofrIorb")?.series ?? [];
  const hyOas = usdMap.get("hyOas")?.series ?? [];
  const broadDollar = usdMap.get("broadDollar")?.series ?? [];
  const usM2 = usdMap.get("m2")?.series ?? [];
  const realYield10y = usdMap.get("realYield10y")?.series ?? [];
  const usdJpy = jpyMap.get("usdJpy")?.series ?? [];
  const jgb10y = jpyMap.get("jgb10y")?.series ?? [];
  const rateSpread = usdEffr && jpyCallAverage ? spreadSeries(usdEffr.points, jpyCallAverage.points) : [];

  const modules = [
    dashboardModule("美元流动性", "净流动性 / M2 / 回购融资", [
      absoluteChangeSeries(netLiquidity, 91),
      percentChangeSeries(usM2, 91),
      invertSeries(absoluteChangeSeries(sofrIorb, 91))
    ]),
    dashboardModule("融资压力", "信用利差 / 美元 / SOFR-IORB", [
      invertSeries(absoluteChangeSeries(hyOas, 91)),
      invertSeries(percentChangeSeries(broadDollar, 91)),
      invertSeries(absoluteChangeSeries(sofrIorb, 91))
    ]),
    dashboardModule("利率估值", "2Y / 10Y / 实际利率", [
      invertSeries(absoluteChangeSeries(dgs2?.points ?? [], 91)),
      invertSeries(absoluteChangeSeries(dgs10?.points ?? [], 91)),
      invertSeries(absoluteChangeSeries(realYield10y, 91))
    ]),
    dashboardModule("日元套息", "美日利差 / USDJPY / JGB", [
      absoluteChangeSeries(rateSpread, 91),
      percentChangeSeries(usdJpy, 91),
      invertSeries(absoluteChangeSeries(jgb10y, 91))
    ]),
    dashboardModule("风险确认", "Nasdaq / HSTECH / BTC", [
      percentChangeSeries(nasdaq?.points ?? [], 91),
      percentChangeSeries(hangSengTech?.points ?? [], 91),
      percentChangeSeries(btc?.points ?? [], 91)
    ])
  ];

  const macroModules = modules.slice(0, 4);
  const macroScoreSum = macroModules.reduce((sum, item) => sum + item.score, 0);
  const globalScore = macroScoreSum;
  const normalizedGlobalScore = globalScore / Math.max(macroModules.length, 1);
  const globalTone = toneForScore(normalizedGlobalScore);
  const globalScoreSeries = scoreSeriesFromModuleIndexes(macroModules);
  const treasuryPressure = standardizeSeries([
    { label: "10Y下行", color: "#2563eb", points: invertSeries(absoluteChangeSeries(dgs10?.points ?? [], 91)) },
    { label: "30Y下行", color: "#7c3aed", points: invertSeries(absoluteChangeSeries(dgs30?.points ?? [], 91)) },
    { label: "实际10Y下行", color: "#0f766e", points: invertSeries(absoluteChangeSeries(realYield10y, 91)) }
  ]);
  const yenCarry = standardizeSeries([
    { label: "美日利差扩大", color: "#2563eb", points: absoluteChangeSeries(rateSpread, 91) },
    { label: "USDJPY上行", color: "#16a34a", points: percentChangeSeries(usdJpy, 91) },
    { label: "JGB10Y下行", color: "#dc2626", points: invertSeries(absoluteChangeSeries(jgb10y, 91)) }
  ]);
  const inflationConstraint = standardizeSeries([
    { label: "美国CPI下行", color: "#dc2626", points: invertSeries(absoluteChangeSeries(usCpi?.points ?? [], 91)) },
    { label: "实际10Y下行", color: "#2563eb", points: invertSeries(absoluteChangeSeries(realYield10y, 91)) },
    { label: "30Y下行", color: "#7c3aed", points: invertSeries(absoluteChangeSeries(dgs30?.points ?? [], 91)) }
  ]);
  const fundingEvidence = standardizeSeries([
    { label: "HY利差收窄", color: "#2563eb", points: invertSeries(absoluteChangeSeries(hyOas, 91)) },
    { label: "美元走弱", color: "#16a34a", points: invertSeries(percentChangeSeries(broadDollar, 91)) },
    { label: "SOFR-IORB回落", color: "#7c3aed", points: invertSeries(absoluteChangeSeries(sofrIorb, 91)) }
  ]);
  const riskConfirmation = [
    { label: "Nasdaq", color: "#2563eb", points: nasdaq?.points ?? [] },
    { label: "HSTECH代理", color: "#16a34a", points: hangSengTech?.points ?? [] },
    { label: "BTC", color: "#f59e0b", points: btc?.points ?? [] }
  ];

  return (
    <section className="terminal global-dashboard" id="terminal">
      <div className={`dashboard-hero tone-${globalTone}`}>
        <div>
          <span>投资环境总分 · 4 项等权</span>
          <strong>{formatScore(globalScore)}</strong>
          <p>{globalScoreText(normalizedGlobalScore)}</p>
          <small className="score-formula">
            四个决策模块直接相加，范围 -8 至 +8
          </small>
        </div>
        <div className="dashboard-rule">
          <b>计算规则</b>
          <p>
            美元流动性、融资压力、利率估值与日元套息直接相加；不取平均、不四舍五入。财政存量和 CPI 属于慢变量，不再进入交易总分；风险确认也不计分。
          </p>
        </div>
      </div>
      <div className="module-lights">
        {modules.map((item) => (
          <div className={`module-light tone-${item.tone}`} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.score > 0 ? `+${item.score}` : item.score}</strong>
            <p>{item.detail}</p>
          </div>
        ))}
      </div>
      <div className="impact-strip">
        {assetImplications(normalizedGlobalScore, modules).map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.call}</strong>
            <p>{item.detail}</p>
          </div>
        ))}
      </div>
      {upcomingEvents.length > 0 ? <UpcomingEvents events={upcomingEvents} /> : null}
      <div className="charts-stack">
        <section className="chart-panel">
          <div className="chart-header">
            <div>
              <span>Layer 1 / Composite Score</span>
              <h3>宏观环境对风险资产有多友好？</h3>
            </div>
            <div className="latest-value">
              <strong>{formatScore(globalScore)}</strong>
              <small>{globalScoreText(normalizedGlobalScore).slice(0, 2)}</small>
            </div>
          </div>
          <LineChart series={globalScoreSeries} color="#0f766e" dateRange={usd.dateRange} valueLabel="全球风险流动性总分" />
          <div className="interpretation">
            <strong>当前解读</strong>
            <p>总分由美元流动性、融资压力、利率估值和日元套息四个模块直接相加；风险确认单独展示，用来验证宏观判断是否被价格承认。</p>
          </div>
        </section>
        <section className="chart-panel">
          <div className="chart-header">
            <div>
              <span>Chart 2 / USD Quantity</span>
              <h3>Fed Net Liquidity</h3>
            </div>
            <div className="latest-value">
              <strong>{formatNumber(netLiquidity.at(-1)?.value, 2)}</strong>
              <small>万亿美元</small>
            </div>
          </div>
          <MultiLineChart
            series={[
              { label: "净流动性", color: "#2563eb", points: netLiquidity },
              { label: "Δ13W", color: "#16a34a", points: absoluteChangeSeries(netLiquidity, 91) },
              { label: "Δ26W", color: "#7c3aed", points: absoluteChangeSeries(netLiquidity, 182) }
            ]}
            dateRange={usd.dateRange}
            valueLabel="Fed Net Liquidity"
          />
          <div className="interpretation">
            <strong>当前解读</strong>
            <p>净流动性绝对水位决定环境，13 周变化决定方向；即使水位仍高，只要动量转负，也应视为边际收紧。</p>
          </div>
        </section>
        <AnalysisDisclosure
          title="查看四项分项证据"
          description="美债长端、日元 Carry、通胀约束和风险资产确认已体现在上方模块灯中，此处保留完整曲线供追溯。"
        >
          <div className="charts-stack">
            <section className="chart-panel">
              <div className="chart-header">
                <div>
                  <span>Chart 3 / Treasury Pressure</span>
                  <h3>美债长端压力</h3>
                </div>
              </div>
              <MultiLineChart series={treasuryPressure} dateRange={usd.dateRange} valueLabel="美债长端压力" />
              <div className="interpretation">
                <strong>当前解读</strong>
                <p>所有分项已方向化：向上代表长端压力缓和，向下代表 10Y、30Y 或实际收益率重新压制高估值资产。</p>
              </div>
            </section>
            <section className="chart-panel">
              <div className="chart-header">
                <div>
                  <span>Chart 4 / Yen Carry</span>
                  <h3>日元 Carry 压力</h3>
                </div>
              </div>
              <MultiLineChart series={yenCarry} dateRange={usd.dateRange} valueLabel="日元 Carry 压力" />
              <div className="interpretation">
                <strong>当前解读</strong>
                <p>向上代表 carry 条件改善：美日利差扩大、USDJPY 上行、JGB 下行。利差收窄叠加日元升值时，风险资产容易出现被动去杠杆。</p>
              </div>
            </section>
            <section className="chart-panel">
              <div className="chart-header">
                <div>
                  <span>Chart 5 / Inflation Constraint</span>
                  <h3>通胀约束</h3>
                </div>
              </div>
              <MultiLineChart series={inflationConstraint} dateRange={usd.dateRange} valueLabel="通胀约束" />
              <div className="interpretation">
                <strong>当前解读</strong>
                <p>当前版本用美国 CPI、10Y 实际收益率和 30Y 作为通胀约束代理；后续可直接加入 Brent、5Y5Y 通胀预期和黄金。</p>
              </div>
            </section>
            <section className="chart-panel">
              <div className="chart-header">
                <div>
                  <span>Chart 6 / Funding Conditions</span>
                  <h3>融资压力</h3>
                </div>
              </div>
              <MultiLineChart series={fundingEvidence} dateRange={usd.dateRange} valueLabel="融资压力" />
              <div className="interpretation">
                <strong>当前解读</strong>
                <p>所有分项已方向化：HY 利差收窄、美元走弱、SOFR-IORB 回落都代表融资条件改善；三者同时反向时优先降低风险预算。</p>
              </div>
            </section>
            <section className="chart-panel">
              <div className="chart-header">
                <div>
                  <span>Chart 7 / Risk Confirmation</span>
                  <h3>风险资产确认</h3>
                </div>
              </div>
              <MultiLineChart
                series={riskConfirmation}
                dateRange={risk.dateRange}
                transform="log-return"
                valueLabel="累计对数收益率（%）"
              />
              <div className="interpretation">
                <strong>当前解读</strong>
                <p>三项资产从共同首个交易日统一归零，再转换为累计对数收益率，避免不同数据起点扭曲相对表现。</p>
              </div>
            </section>
          </div>
        </AnalysisDisclosure>
      </div>
    </section>
  );
}

function findSeries(charts: InterestRateChart[] | undefined, key: string) {
  return charts?.flatMap((chart) => chart.series).find((item) => item.key === key);
}

function dashboardModule(label: string, detail: string, components: DataPoint[][]) {
  const validComponents = components.filter((series) => series.length > 0);
  const index = averageAlignedSeries(
    standardizeSeries(validComponents.map((points, index) => ({ label: `${label}-${index}`, color: "#0f766e", points })))
  );
  const latest = index.at(-1)?.value ?? 0;
  const score = scoreFromZ(latest);
  return { detail, index, label, score, tone: toneForScore(score) };
}

function scoreSeriesFromModuleIndexes(modules: { index: DataPoint[] }[]) {
  const maps = modules.map((module) => new Map(module.index.map((point) => [point.date, point.value])));
  const dates = [...new Set(modules.flatMap((module) => module.index.map((point) => point.date)))].sort();
  return dates
    .map((date) => {
      const values = maps.map((map) => latestBeforeOrOn(map, date));
      if (values.some((value) => value === undefined)) return null;
      return {
        date,
        value: values.reduce<number>((sum, value) => sum + scoreFromZ(value ?? 0), 0)
      };
    })
    .filter((point): point is DataPoint => point !== null);
}

function scoreFromZ(value: number) {
  if (value >= 0.65) return 2;
  if (value >= 0.2) return 1;
  if (value <= -0.65) return -2;
  if (value <= -0.2) return -1;
  return 0;
}

function toneForScore(score: number) {
  if (score >= 1.5) return "green";
  if (score >= 0.5) return "light";
  if (score > -0.5) return "neutral";
  if (score > -1.5) return "yellow";
  return "red";
}

function globalScoreText(score: number) {
  if (score >= 1.5) return "强顺风";
  if (score >= 0.5) return "温和顺风";
  if (score > -0.5) return "中性震荡";
  if (score > -1.5) return "黄灯偏紧";
  return "红灯防守";
}

function formatScore(score: number) {
  const formatted = formatNumber(score, 2);
  return score > 0 ? `+${formatted}` : formatted;
}

function assetImplications(globalScore: number, modules: { label: string; score: number }[]) {
  const yenScore = modules.find((item) => item.label === "日元套息")?.score ?? 0;
  const treasuryScore = modules.find((item) => item.label === "利率估值")?.score ?? 0;
  const fundingScore = modules.find((item) => item.label === "融资压力")?.score ?? 0;
  const riskScore = modules.find((item) => item.label === "风险确认")?.score ?? 0;
  return [
    {
      label: "美股 AI",
      call: globalScore >= 1 && treasuryScore >= 0 ? "可进攻" : globalScore <= -1 ? "不追高" : "等确认",
      detail: treasuryScore < 0 || fundingScore < 0 ? "利率估值或融资条件仍是约束。" : "需要风险确认继续走强。"
    },
    {
      label: "港科",
      call: globalScore >= 1 && yenScore >= 0 ? "顺风改善" : "流动性敏感",
      detail: "美元价格和日元 carry 同时恶化时弹性会被压住。"
    },
    {
      label: "BTC",
      call: globalScore >= 1 && riskScore >= 0 ? "顺风" : globalScore <= -1 ? "防守" : "震荡",
      detail: "更依赖净流动性动量和实际利率方向。"
    }
  ];
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
      title: "两大央行是否同步扩张资产负债表？",
      description: "Fed 总资产与 BOJ 总资产，观察两大央行基础流动性的相对扩张或收缩。",
      left: usdMap.get("fedBalanceSheet"),
      right: jpyMap.get("bojAssets"),
      leftLabel: "Fed WALCL",
      rightLabel: "BOJ JPNASSETS"
    },
    {
      title: "美国与日本的广义货币是否同步增长？",
      description: "美国 M2 与日本 M2，观察两国广义货币环境的中周期方向。",
      left: usdMap.get("m2"),
      right: jpyMap.get("m2Japan"),
      leftLabel: "US M2",
      rightLabel: "Japan M2"
    },
    {
      title: "哪种货币环境对风险资产更友好？",
      description: "美元 DLI 与日元 DLI 使用同一 0-100 评分区间，可直接比较宽松/收紧温度。",
      left: { series: usd.composite.series } as IndicatorSnapshot,
      right: { series: jpy.composite.series } as IndicatorSnapshot,
      leftLabel: "USD DLI",
      rightLabel: "JPY DLI",
      rawScale: true
    },
    {
      title: "长端资金成本是否同步抬升？",
      description: "美国 10Y 实际利率与日本 10Y 国债收益率，观察资金价格是否同步抬升。",
      left: usdMap.get("realYield10y"),
      right: jpyMap.get("jgb10y"),
      leftLabel: "US 10Y TIPS",
      rightLabel: "JGB 10Y"
    },
    {
      title: "美元走强是否正在放大日元套息压力？",
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
        <h2>美元与日元流动性是否同向？</h2>
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
                <h3>美元与日元的短端息差还有多大？</h3>
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

function averageAlignedSeries(series: { label: string; color: string; points: DataPoint[] }[]) {
  const maps = series.map((item) => new Map(item.points.map((point) => [point.date, point.value])));
  const dates = [...new Set(series.flatMap((item) => item.points.map((point) => point.date)))].sort();
  const minimumComponents = Math.max(2, Math.ceil(series.length / 2));

  return dates
    .map((date) => {
      const values = maps
        .map((map) => latestBeforeOrOn(map, date))
        .filter((value): value is number => value !== undefined);

      if (values.length < minimumComponents) return null;
      return { date, value: values.reduce((sum, value) => sum + value, 0) / values.length };
    })
    .filter(Boolean) as DataPoint[];
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
