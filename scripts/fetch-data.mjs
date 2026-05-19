import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const outputDir = resolve(repoRoot, "public/data");

const lookbackYears = 10;
const startDate = new Date();
startDate.setUTCFullYear(startDate.getUTCFullYear() - lookbackYears);
const startIso = startDate.toISOString().slice(0, 10);

const usdDefinitions = [
  {
    key: "fedBalanceSheet",
    fredId: "WALCL",
    name: "美联储资产负债表规模",
    shortName: "Fed 总资产",
    group: "政策与准备金",
    unit: "万亿美元",
    source: "FRED WALCL",
    sourceUrl: "https://fred.stlouisfed.org/series/WALCL",
    direction: "up_is_looser",
    weight: 0.18,
    scale: 1 / 1_000_000,
    description: "Fed 资产扩张通常释放基础流动性，缩表则减少系统准备金。"
  },
  {
    key: "tga",
    fredId: "WTREGEN",
    name: "美国财政部一般账户余额",
    shortName: "TGA",
    group: "政策与准备金",
    unit: "万亿美元",
    source: "FRED WTREGEN",
    sourceUrl: "https://fred.stlouisfed.org/series/WTREGEN",
    direction: "up_is_tighter",
    weight: 0.14,
    scale: 1 / 1_000_000,
    description: "TGA 上升代表资金进入财政部账户，通常从银行准备金体系抽水。"
  },
  {
    key: "onRrp",
    fredId: "RRPONTSYD",
    name: "隔夜逆回购余额",
    shortName: "ON RRP",
    group: "政策与准备金",
    unit: "万亿美元",
    source: "FRED RRPONTSYD",
    sourceUrl: "https://fred.stlouisfed.org/series/RRPONTSYD",
    direction: "up_is_tighter",
    weight: 0.12,
    scale: 1 / 1_000,
    description: "货币基金停放在 ON RRP 的规模越大，留在市场内的可用流动性越少。"
  },
  {
    key: "m2",
    fredId: "WM2NS",
    name: "M2 货币供应量",
    shortName: "M2",
    group: "广义流动性",
    unit: "万亿美元",
    source: "FRED WM2NS",
    sourceUrl: "https://fred.stlouisfed.org/series/WM2NS",
    direction: "up_is_looser",
    weight: 0.1,
    scale: 1 / 1_000,
    description: "广义货币扩张对风险资产和信用环境形成中周期支持。"
  },
  {
    key: "sofr",
    fredId: "SOFR",
    hidden: true,
    scale: 1
  },
  {
    key: "iorb",
    fredId: "IORB",
    hidden: true,
    scale: 1
  },
  {
    key: "srf",
    fredId: "RPONTSYD",
    name: "常备回购便利使用量",
    shortName: "SRF",
    group: "融资与管道",
    unit: "十亿美元",
    source: "FRED RPONTSYD / NY Fed Repo Operations",
    sourceUrl: "https://fred.stlouisfed.org/series/RPONTSYD",
    direction: "up_is_tighter",
    weight: 0.06,
    scale: 1,
    description: "SRF 使用量异常上升代表市场需要向 Fed 借入流动性。"
  },
  {
    key: "vix",
    fredId: "VIXCLS",
    name: "VIX 波动率指数",
    shortName: "VIX",
    group: "风险与价格",
    unit: "点",
    source: "FRED VIXCLS",
    sourceUrl: "https://fred.stlouisfed.org/series/VIXCLS",
    direction: "up_is_tighter",
    weight: 0.06,
    scale: 1,
    description: "波动率上升会压缩风险预算，放大去杠杆压力。"
  },
  {
    key: "hyOas",
    fredId: "BAMLH0A0HYM2",
    name: "高收益债信用利差",
    shortName: "HY OAS",
    group: "信用与中介",
    unit: "bp",
    source: "FRED BAMLH0A0HYM2",
    sourceUrl: "https://fred.stlouisfed.org/series/BAMLH0A0HYM2",
    direction: "up_is_tighter",
    weight: 0.06,
    scale: 100,
    description: "信用利差扩张说明融资条件收紧，风险资产贴现率上升。"
  },
  {
    key: "broadDollar",
    fredId: "DTWEXBGS",
    name: "广义美元指数",
    shortName: "美元指数",
    group: "风险与价格",
    unit: "指数",
    source: "FRED DTWEXBGS",
    sourceUrl: "https://fred.stlouisfed.org/series/DTWEXBGS",
    direction: "up_is_tighter",
    weight: 0.06,
    scale: 1,
    description: "美元走强通常收紧离岸美元融资和全球风险偏好。"
  },
  {
    key: "realYield10y",
    fredId: "DFII10",
    name: "10Y 实际利率",
    shortName: "10Y TIPS",
    group: "风险与价格",
    unit: "%",
    source: "FRED DFII10",
    sourceUrl: "https://fred.stlouisfed.org/series/DFII10",
    direction: "up_is_tighter",
    weight: 0.06,
    scale: 1,
    description: "实际利率越高，远期现金流和高久期资产的估值压力越大。"
  }
];

const usdDerivedDefinitions = [
  {
    key: "netLiquidity",
    name: "综合净流动性指数",
    shortName: "净流动性",
    group: "广义流动性",
    unit: "万亿美元",
    source: "WALCL - WTREGEN - RRPONTSYD",
    sourceUrl: "https://fred.stlouisfed.org/",
    direction: "up_is_looser",
    weight: 0.18,
    formula: "Fed 总资产 - TGA - ON RRP",
    description: "常用的近似美元净流动性口径，反映央行资产侧扣除财政与逆回购吸收后的余额。"
  },
  {
    key: "sofrIorb",
    name: "SOFR - IORB 利差",
    shortName: "SOFR-IORB",
    group: "融资与管道",
    unit: "bp",
    source: "FRED SOFR, IORB",
    sourceUrl: "https://fred.stlouisfed.org/series/SOFR",
    direction: "up_is_tighter",
    weight: 0.08,
    formula: "(SOFR - IORB) * 100",
    description: "回购融资压力抬升时，SOFR 相对 IORB 走高，提示准备金边际紧张。"
  }
];

const usdRateDefinitions = [
  {
    key: "effr",
    fredId: "EFFR",
    label: "EFFR",
    unit: "%",
    source: "FRED EFFR / Federal Reserve Bank of New York",
    sourceUrl: "https://fred.stlouisfed.org/series/EFFR",
    scale: 1,
    description: "EFFR 是隔夜无担保联邦基金交易的成交量加权中位数，是 Fed 政策传导的核心市场利率。"
  },
  {
    key: "fedTargetUpper",
    fredId: "DFEDTARU",
    label: "目标上限",
    unit: "%",
    source: "FRED DFEDTARU / Federal Reserve Board",
    sourceUrl: "https://fred.stlouisfed.org/series/DFEDTARU",
    scale: 1,
    description: "FOMC 设定的联邦基金目标区间上限。"
  },
  {
    key: "fedTargetLower",
    fredId: "DFEDTARL",
    label: "目标下限",
    unit: "%",
    source: "FRED DFEDTARL / Federal Reserve Board",
    sourceUrl: "https://fred.stlouisfed.org/series/DFEDTARL",
    scale: 1,
    description: "FOMC 设定的联邦基金目标区间下限。"
  },
  {
    key: "fedIorb",
    fredId: "IORB",
    label: "IORB",
    unit: "%",
    source: "FRED IORB / Federal Reserve Board",
    sourceUrl: "https://fred.stlouisfed.org/series/IORB",
    scale: 1,
    description: "IORB 是 Fed 支付给银行准备金余额的利率，通常构成货币市场利率走廊的重要锚。"
  },
  {
    key: "fedSofr",
    fredId: "SOFR",
    label: "SOFR",
    unit: "%",
    source: "FRED SOFR / Federal Reserve Bank of New York",
    sourceUrl: "https://fred.stlouisfed.org/series/SOFR",
    scale: 1,
    description: "SOFR 反映以美国国债回购为抵押的隔夜融资成本，可观察担保融资市场压力。"
  }
];

const jpyDefinitions = [
  {
    key: "bojAssets",
    fredId: "JPNASSETS",
    name: "日本银行总资产",
    shortName: "BOJ 总资产",
    group: "央行资产负债表",
    unit: "兆日元",
    source: "FRED JPNASSETS / Bank of Japan Accounts",
    sourceUrl: "https://fred.stlouisfed.org/series/JPNASSETS",
    direction: "up_is_looser",
    weight: 0.18,
    scale: 1 / 10_000,
    description: "BOJ 资产扩张通常代表央行向体系提供更多日元基础流动性，缩表则反向。"
  },
  {
    key: "monetaryBase",
    bojDb: "MD01",
    bojCode: "MABS1AN11",
    name: "货币基础平均余额",
    shortName: "货币基础",
    group: "基础货币",
    unit: "兆日元",
    source: "BOJ MD01 MABS1AN11",
    sourceUrl: "https://www.stat-search.boj.or.jp/index_en.html",
    direction: "up_is_looser",
    weight: 0.18,
    scale: 1 / 10_000,
    description: "BOJ 定义的货币基础为纸币、硬币与日银当座存款之和，是日元基础流动性的核心口径。"
  },
  {
    key: "bojCurrentAccounts",
    bojDb: "MD01",
    bojCode: "MABS1AN113",
    name: "日银当座存款平均余额",
    shortName: "当座存款",
    group: "银行准备金",
    unit: "兆日元",
    source: "BOJ MD01 MABS1AN113",
    sourceUrl: "https://www.stat-search.boj.or.jp/index_en.html",
    direction: "up_is_looser",
    weight: 0.16,
    scale: 1 / 10_000,
    description: "金融机构在 BOJ 的当座存款越高，银行体系可动用准备金越充足。"
  },
  {
    key: "reserveBalances",
    bojDb: "MD01",
    bojCode: "MABS1AN114",
    name: "准备金平均余额",
    shortName: "准备金",
    group: "银行准备金",
    unit: "兆日元",
    source: "BOJ MD01 MABS1AN114",
    sourceUrl: "https://www.stat-search.boj.or.jp/index_en.html",
    direction: "up_is_looser",
    weight: 0.12,
    scale: 1 / 10_000,
    description: "准备金余额反映商业银行体系持有的央行货币，快速下降通常意味着边际流动性收缩。"
  },
  {
    key: "m2Japan",
    bojDb: "MD02",
    bojCode: "MAM1NAM2M2MO",
    name: "日本 M2 平均余额",
    shortName: "M2",
    group: "广义流动性",
    unit: "兆日元",
    source: "BOJ MD02 MAM1NAM2M2MO",
    sourceUrl: "https://www.stat-search.boj.or.jp/index_en.html",
    direction: "up_is_looser",
    weight: 0.12,
    scale: 1 / 10_000,
    description: "M2 扩张代表居民、企业和部分金融机构可用存款货币增加，对国内信用环境更友好。"
  },
  {
    key: "broadLiquidityJapan",
    bojDb: "MD02",
    bojCode: "MAM1NABLBLMO",
    name: "广义定义流动性 L",
    shortName: "L",
    group: "广义流动性",
    unit: "兆日元",
    source: "BOJ MD02 MAM1NABLBLMO",
    sourceUrl: "https://www.stat-search.boj.or.jp/index_en.html",
    direction: "up_is_looser",
    weight: 0.12,
    scale: 1 / 10_000,
    description: "BOJ 的 L 口径覆盖 M3 之外的信托、投信、银行债、金融机构 CP、国债和外债等高流动性资产。"
  },
  {
    key: "jgb10y",
    fredId: "IRLTLT01JPM156N",
    name: "日本 10 年期国债收益率",
    shortName: "JGB 10Y",
    group: "利率与融资",
    unit: "%",
    source: "FRED IRLTLT01JPM156N / OECD",
    sourceUrl: "https://fred.stlouisfed.org/series/IRLTLT01JPM156N",
    direction: "up_is_tighter",
    weight: 0.12,
    scale: 1,
    description: "JGB 长端收益率上行会提高日元融资成本，并压缩以低日元利率为基础的套利空间。"
  },
  {
    key: "usdJpy",
    fredId: "DEXJPUS",
    name: "美元兑日元汇率",
    shortName: "USD/JPY",
    group: "汇率与套息",
    unit: "日元/美元",
    source: "FRED DEXJPUS",
    sourceUrl: "https://fred.stlouisfed.org/series/DEXJPUS",
    direction: "up_is_looser",
    weight: 0.1,
    scale: 1,
    description: "USD/JPY 上升通常对应日元走弱和套息环境更顺；急速下行则容易触发日元空头和 carry trade 去杠杆。"
  }
];

const jpyRateDefinitions = [
  {
    key: "jpyCallAverage",
    bojDb: "FM01",
    bojCode: "STRDCLUCON",
    label: "无担保隔夜拆借平均",
    unit: "%",
    source: "BOJ FM01 STRDCLUCON",
    sourceUrl: "https://www.boj.or.jp/en/statistics/market/short/mutan/index.htm",
    scale: 1,
    description: "日本无担保隔夜拆借平均利率，是观察 BOJ 政策目标传导和日元隔夜资金成本的核心市场利率。"
  },
  {
    key: "jpyCallHigh",
    bojDb: "FM01",
    bojCode: "STRDCLUCONH",
    label: "无担保隔夜拆借最高",
    unit: "%",
    source: "BOJ FM01 STRDCLUCONH",
    sourceUrl: "https://www.boj.or.jp/en/statistics/market/short/mutan/index.htm",
    scale: 1,
    description: "当日无担保隔夜拆借成交利率高点，可用于观察日内资金紧张尾部。"
  },
  {
    key: "jpyCallLow",
    bojDb: "FM01",
    bojCode: "STRDCLUCONL",
    label: "无担保隔夜拆借最低",
    unit: "%",
    source: "BOJ FM01 STRDCLUCONL",
    sourceUrl: "https://www.boj.or.jp/en/statistics/market/short/mutan/index.htm",
    scale: 1,
    description: "当日无担保隔夜拆借成交利率低点，可与平均值和高点一起观察拆借市场分布。"
  },
  {
    key: "jpyBasicLoanRate",
    bojDb: "IR01",
    bojCode: "MADR1Z@D",
    label: "基本贷款利率",
    unit: "%",
    source: "BOJ IR01 MADR1Z@D",
    sourceUrl: "https://www.boj.or.jp/en/statistics/boj/other/discount/discount.htm",
    scale: 1,
    description: "BOJ 基本贴现率与基本贷款利率，属于日央行公布的官方贷款利率口径。"
  },
  {
    key: "jpyJgb10yRate",
    fredId: "IRLTLT01JPM156N",
    label: "JGB 10Y",
    unit: "%",
    source: "FRED IRLTLT01JPM156N / OECD",
    sourceUrl: "https://fred.stlouisfed.org/series/IRLTLT01JPM156N",
    scale: 1,
    description: "日本 10 年期国债收益率代表日元长期无风险利率约束。"
  }
];

async function fetchFredSeries({ fredId, scale }) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${fredId}&cosd=${startIso}`;
  const response = await fetch(url, {
    headers: { "user-agent": "global-liquidity-monitor/0.1" }
  });
  if (!response.ok) {
    throw new Error(`FRED ${fredId} failed: ${response.status} ${response.statusText}`);
  }
  const csv = await response.text();
  const lines = csv.trim().split(/\r?\n/).slice(1);
  return lines
    .map((line) => {
      const [date, raw] = line.split(",");
      const numeric = Number(raw);
      if (!date || raw === "." || Number.isNaN(numeric)) return null;
      return { date, value: round(numeric * scale, 4) };
    })
    .filter(Boolean);
}

async function fetchBojSeries({ bojDb, bojCode, scale }) {
  const startMonth = startIso.slice(0, 7).replace("-", "");
  const url = `https://www.stat-search.boj.or.jp/api/v1/getDataCode?format=json&lang=en&db=${bojDb}&startDate=${startMonth}&code=${bojCode}`;
  const response = await fetch(url, {
    headers: {
      "accept": "application/json",
      "user-agent": "global-liquidity-monitor/0.1"
    }
  });
  if (!response.ok) {
    throw new Error(`BOJ ${bojDb}/${bojCode} failed: ${response.status} ${response.statusText}`);
  }
  const payload = await response.json();
  if (payload.STATUS !== 200) {
    throw new Error(`BOJ ${bojDb}/${bojCode} failed: ${payload.MESSAGE ?? payload.STATUS}`);
  }
  const result = payload.RESULTSET?.find((item) => item.SERIES_CODE === bojCode);
  const dates = result?.VALUES?.SURVEY_DATES ?? [];
  const values = result?.VALUES?.VALUES ?? [];

  return dates
    .map((dateValue, index) => {
      const raw = values[index];
      const numeric = Number(raw);
      const date = String(dateValue);
      if ((date.length !== 6 && date.length !== 8) || raw === null || raw === "" || Number.isNaN(numeric)) {
        return null;
      }
      const isoDate =
        date.length === 8
          ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
          : `${date.slice(0, 4)}-${date.slice(4, 6)}-01`;
      return { date: isoDate, value: round(numeric * scale, 4) };
    })
    .filter(Boolean);
}

function byDate(series) {
  return new Map(series.map((point) => [point.date, point.value]));
}

function intersectSeries(left, right, compute) {
  const rightMap = byDate(right);
  return left
    .map((point) => {
      const rightValue = rightMap.get(point.date);
      if (rightValue === undefined) return null;
      return { date: point.date, value: round(compute(point.value, rightValue), 4) };
    })
    .filter(Boolean);
}

function latestBeforeOrOn(map, date) {
  if (map.has(date)) return map.get(date);
  const keys = [...map.keys()].filter((item) => item <= date).sort();
  return keys.length > 0 ? map.get(keys[keys.length - 1]) : undefined;
}

function netLiquidity(fed, tga, onRrp) {
  const tgaMap = byDate(tga);
  const rrpMap = byDate(onRrp);
  return fed
    .map((point) => {
      const tgaValue = latestBeforeOrOn(tgaMap, point.date);
      const rrpValue = latestBeforeOrOn(rrpMap, point.date);
      if (tgaValue === undefined || rrpValue === undefined) return null;
      return { date: point.date, value: round(point.value - tgaValue - rrpValue, 4) };
    })
    .filter(Boolean);
}

function snapshot(definition, series) {
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.at(-1);
  if (!latest) {
    return {
      key: definition.key,
      latestDate: "",
      latestValue: 0,
      previousValue: null,
      oneDayChange: null,
      oneMonthChange: null,
      percentile: null,
      zScore: null,
      scoreContribution: null,
      series: []
    };
  }

  const previous = sorted.at(-2) ?? null;
  const monthAgo = sorted.findLast((item) => item.date <= offsetDate(latest.date, -30)) ?? null;
  const values = sorted.map((item) => item.value);
  const percentile = percentileRank(values, latest.value);
  const zScore = zscore(values, latest.value);
  const directionalScore =
    zScore === null ? null : definition.direction === "up_is_looser" ? zScore : -zScore;

  return {
    key: definition.key,
    latestDate: latest.date,
    latestValue: latest.value,
    previousValue: previous?.value ?? null,
    oneDayChange: previous ? round(latest.value - previous.value, 4) : null,
    oneMonthChange: monthAgo ? round(latest.value - monthAgo.value, 4) : null,
    percentile,
    zScore,
    scoreContribution:
      directionalScore === null ? null : round(clamp(directionalScore, -2.5, 2.5) * definition.weight, 4),
    series: sorted
  };
}

function compositeSeries(definitionsForScore, snapshots) {
  const maps = new Map(snapshots.map((item) => [item.key, byDate(item.series)]));
  const dateSet = new Set();
  snapshots.forEach((item) => item.series.forEach((point) => dateSet.add(point.date)));
  const dates = [...dateSet].sort();

  return dates
    .map((date) => {
      let weightedScore = 0;
      let usedWeight = 0;

      for (const definition of definitionsForScore) {
        const seriesMap = maps.get(definition.key);
        const value = seriesMap?.get(date);
        const fullSeries = snapshots.find((item) => item.key === definition.key)?.series ?? [];
        if (value === undefined || fullSeries.length < 20) continue;
        const history = fullSeries.filter((point) => point.date <= date).map((point) => point.value);
        const z = zscore(history, value);
        if (z === null) continue;
        const directional = definition.direction === "up_is_looser" ? z : -z;
        weightedScore += clamp(directional, -2.5, 2.5) * definition.weight;
        usedWeight += definition.weight;
      }

      if (usedWeight < 0.5) return null;
      return { date, value: round((weightedScore / usedWeight) * 20 + 50, 2) };
    })
    .filter(Boolean);
}

function percentileRank(values, value) {
  if (values.length === 0) return null;
  const below = values.filter((item) => item <= value).length;
  return round((below / values.length) * 100, 1);
}

function zscore(values, value) {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, item) => sum + item, 0) / values.length;
  const variance = values.reduce((sum, item) => sum + (item - mean) ** 2, 0) / (values.length - 1);
  const standardDeviation = Math.sqrt(variance);
  if (standardDeviation === 0) return null;
  return round((value - mean) / standardDeviation, 3);
}

function offsetDate(date, days) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function labelForScore(score) {
  if (score === null) return "数据不足";
  if (score >= 62) return "宽松";
  if (score <= 38) return "收紧";
  return "中性";
}

async function main() {
  await writeDataset("liquidity.json", await buildUsdDataset());
  await writeDataset("yen-liquidity.json", await buildJpyDataset());
}

async function fetchSeriesForDefinitions(definitionsForFetch) {
  const entries = await Promise.all(
    definitionsForFetch
      .filter((definition) => definition.fredId || definition.bojCode)
      .map(async (definition) => [
        definition.key,
        definition.fredId ? await fetchFredSeries(definition) : await fetchBojSeries(definition)
      ])
  );
  return new Map(entries);
}

function stripInternalFields(definitionsForOutput) {
  return definitionsForOutput.map(({ fredId, bojDb, bojCode, scale, hidden, ...definition }) => definition);
}

function interestRateSeries(definition, seriesMap, color) {
  return {
    key: definition.key,
    label: definition.label,
    color,
    unit: definition.unit,
    source: definition.source,
    sourceUrl: definition.sourceUrl,
    description: definition.description,
    points: [...(seriesMap.get(definition.key) ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  };
}

function rateDefinition(key, definitionsForRates) {
  const definition = definitionsForRates.find((item) => item.key === key);
  if (!definition) throw new Error(`Missing rate definition: ${key}`);
  return definition;
}

function usdRateCharts(seriesMap) {
  return [
    {
      title: "美联储利率变化曲线",
      description: "跟踪 FOMC 目标区间、有效联邦基金利率、IORB 与 SOFR 随时间变化，用于观察 Fed 政策利率走廊和隔夜融资成本。",
      series: [
        interestRateSeries(rateDefinition("fedTargetUpper", usdRateDefinitions), seriesMap, "#94a3b8"),
        interestRateSeries(rateDefinition("fedTargetLower", usdRateDefinitions), seriesMap, "#cbd5e1"),
        interestRateSeries(rateDefinition("effr", usdRateDefinitions), seriesMap, "#2563eb"),
        interestRateSeries(rateDefinition("fedIorb", usdRateDefinitions), seriesMap, "#0f766e"),
        interestRateSeries(rateDefinition("fedSofr", usdRateDefinitions), seriesMap, "#dc2626")
      ]
    }
  ];
}

function jpyRateCharts(seriesMap) {
  return [
    {
      title: "日本央行利率变化曲线",
      description: "跟踪 BOJ 无担保隔夜拆借利率与基本贷款利率随时间变化，用于观察日元短端政策传导和资金成本。",
      series: [
        interestRateSeries(rateDefinition("jpyCallAverage", jpyRateDefinitions), seriesMap, "#2563eb"),
        interestRateSeries(rateDefinition("jpyCallHigh", jpyRateDefinitions), seriesMap, "#dc2626"),
        interestRateSeries(rateDefinition("jpyCallLow", jpyRateDefinitions), seriesMap, "#16a34a"),
        interestRateSeries(rateDefinition("jpyBasicLoanRate", jpyRateDefinitions), seriesMap, "#0f766e")
      ]
    }
  ];
}

async function buildUsdDataset() {
  const seriesMap = await fetchSeriesForDefinitions(usdDefinitions);
  const rateSeriesMap = await fetchSeriesForDefinitions(usdRateDefinitions);

  const net = netLiquidity(
    seriesMap.get("fedBalanceSheet") ?? [],
    seriesMap.get("tga") ?? [],
    seriesMap.get("onRrp") ?? []
  );
  const sofrIorb = intersectSeries(seriesMap.get("sofr") ?? [], seriesMap.get("iorb") ?? [], (sofr, iorb) =>
    (sofr - iorb) * 100
  );

  seriesMap.set("netLiquidity", net);
  seriesMap.set("sofrIorb", sofrIorb);

  const visibleDefinitions = [
    ...usdDefinitions.filter((definition) => !definition.hidden),
    ...usdDerivedDefinitions
  ].sort((a, b) => b.weight - a.weight);

  const snapshots = visibleDefinitions.map((definition) => snapshot(definition, seriesMap.get(definition.key) ?? []));
  const composite = compositeSeries(visibleDefinitions, snapshots);
  const latestComposite = composite.at(-1) ?? null;

  return {
    generatedAt: new Date().toISOString(),
    lookbackYears,
    indicators: stripInternalFields(visibleDefinitions),
    snapshots,
    rateCharts: usdRateCharts(rateSeriesMap),
    composite: {
      score: latestComposite?.value ?? null,
      label: labelForScore(latestComposite?.value ?? null),
      date: latestComposite?.date ?? null,
      series: composite
    },
    notes: [
      "FRED CSV 在构建阶段抓取，前端只读取本仓库生成的 JSON，避免 GitHub Pages 运行时跨域和限流问题。",
      "净流动性采用近似口径：Fed 总资产 - TGA - ON RRP；不同机构可能使用准备金、财政现金和 RRP 的不同组合。",
      "综合评分使用各指标十年历史 Z-score 的方向化加权值，转换为 0-100 区间；它是监控仪表盘，不是投资建议。"
    ]
  };
}

async function buildJpyDataset() {
  const seriesMap = await fetchSeriesForDefinitions(jpyDefinitions);
  const rateSeriesMap = await fetchSeriesForDefinitions(jpyRateDefinitions);
  const visibleDefinitions = [...jpyDefinitions].sort((a, b) => b.weight - a.weight);
  const snapshots = visibleDefinitions.map((definition) => snapshot(definition, seriesMap.get(definition.key) ?? []));
  const composite = compositeSeries(visibleDefinitions, snapshots);
  const latestComposite = composite.at(-1) ?? null;

  return {
    generatedAt: new Date().toISOString(),
    lookbackYears,
    indicators: stripInternalFields(visibleDefinitions),
    snapshots,
    rateCharts: jpyRateCharts(rateSeriesMap),
    composite: {
      score: latestComposite?.value ?? null,
      label: labelForScore(latestComposite?.value ?? null),
      date: latestComposite?.date ?? null,
      series: composite
    },
    notes: [
      "BOJ 官方 Time-Series Data Search API 在构建阶段抓取货币基础、当座存款、准备金、M2 与广义定义流动性 L。",
      "BOJ 总资产、USD/JPY 和日本 10 年期国债收益率使用 FRED 无密钥 CSV 序列；其中 BOJ 总资产的原始来源仍为 Bank of Japan Accounts。",
      "日元综合评分同样使用十年 Z-score 方向化加权。货币量、准备金和 USD/JPY 上升按偏宽松处理，JGB 10Y 上升按偏收紧处理。"
    ]
  };
}

async function writeDataset(fileName, dataset) {
  const outputPath = resolve(outputDir, fileName);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`);
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
