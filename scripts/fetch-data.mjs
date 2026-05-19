import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const outputPath = resolve(repoRoot, "public/data/liquidity.json");

const lookbackYears = 10;
const startDate = new Date();
startDate.setUTCFullYear(startDate.getUTCFullYear() - lookbackYears);
const startIso = startDate.toISOString().slice(0, 10);

const definitions = [
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

const derivedDefinitions = [
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
  const rawDefinitions = definitions.filter((definition) => definition.fredId);
  const entries = await Promise.all(
    rawDefinitions.map(async (definition) => [definition.key, await fetchFredSeries(definition)])
  );
  const seriesMap = new Map(entries);

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
    ...definitions.filter((definition) => !definition.hidden),
    ...derivedDefinitions
  ].sort((a, b) => b.weight - a.weight);

  const snapshots = visibleDefinitions.map((definition) => snapshot(definition, seriesMap.get(definition.key) ?? []));
  const composite = compositeSeries(visibleDefinitions, snapshots);
  const latestComposite = composite.at(-1) ?? null;

  const dataset = {
    generatedAt: new Date().toISOString(),
    lookbackYears,
    indicators: visibleDefinitions.map(({ fredId, scale, hidden, ...definition }) => definition),
    snapshots,
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

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`);
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
