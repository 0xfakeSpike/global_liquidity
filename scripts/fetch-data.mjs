import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const outputDir = resolve(repoRoot, "public/data");
const execFileAsync = promisify(execFile);

const lookbackYears = 10;
const startDate = new Date();
startDate.setUTCFullYear(startDate.getUTCFullYear() - lookbackYears);
const startIso = startDate.toISOString().slice(0, 10);
const endIso = new Date().toISOString().slice(0, 10);
const inflationStartDate = new Date(startDate);
inflationStartDate.setUTCMonth(inflationStartDate.getUTCMonth() - 14);
const inflationStartIso = inflationStartDate.toISOString().slice(0, 10);

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

const usdInflationDefinitions = [
  {
    key: "usCpiIndex",
    fredId: "CPIAUCSL",
    label: "美国 CPI 同比",
    unit: "%",
    source: "FRED CPIAUCSL / U.S. Bureau of Labor Statistics",
    sourceUrl: "https://fred.stlouisfed.org/series/CPIAUCSL",
    scale: 1,
    description: "美国 CPI-U All Items，使用 FRED 的月度指数序列计算同比变化。"
  }
];

const jpyInflationDefinitions = [
  {
    key: "japanCpiIndex",
    label: "日本 CPI 同比",
    unit: "%",
    source: "e-Stat / Statistics Bureau of Japan CPI 2020-base",
    sourceUrl: "https://www.e-stat.go.jp/en/stat-search/files?stat_infid=000032103842",
    scale: 1,
    description: "日本全国 CPI All items，使用日本 e-Stat/总务省统计局 2020 基准月度指数计算同比变化。"
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

const riskDefinitions = [
  {
    key: "btc",
    fredId: "CBBTCUSD",
    label: "BTC",
    unit: "Index",
    source: "FRED CBBTCUSD / Coinbase",
    sourceUrl: "https://fred.stlouisfed.org/series/CBBTCUSD",
    scale: 1,
    color: "#f59e0b",
    description: "Bitcoin 美元现货价格，使用 FRED 的 Coinbase BTC/USD 日频序列。"
  },
  {
    key: "nasdaq",
    fredId: "NASDAQCOM",
    label: "纳斯达克综合指数",
    unit: "Index",
    source: "FRED NASDAQCOM / Nasdaq",
    sourceUrl: "https://fred.stlouisfed.org/series/NASDAQCOM",
    scale: 1,
    color: "#2563eb",
    description: "纳斯达克综合指数，代表美国成长和科技风险偏好的核心公开市场指标。"
  },
  {
    key: "hangSengTech",
    yahooSymbol: "3033.HK",
    label: "恒生科技指数代理",
    unit: "Index",
    source: "Yahoo Finance 3033.HK / CSOP Hang Seng TECH Index ETF",
    sourceUrl: "https://finance.yahoo.com/quote/3033.HK/history/",
    scale: 1,
    color: "#16a34a",
    description: "恒生科技指数跟踪代理。HSTECH.HK 历史接口不稳定，使用 3033.HK ETF 作为可自动更新的历史序列。"
  }
];

const treasuryDefinitions = [
  {
    key: "totalPublicDebt",
    fredId: "GFDEBTN",
    label: "联邦总债务",
    unit: "万亿美元",
    source: "FRED GFDEBTN / U.S. Treasury Fiscal Service",
    sourceUrl: "https://fred.stlouisfed.org/series/GFDEBTN",
    scale: 1 / 1_000_000,
    color: "#0f766e",
    description: "美国联邦总债务，包含公众持有债务与政府账户持有债务。"
  },
  {
    key: "debtHeldByPublic",
    fredId: "FYGFDPUN",
    label: "公众持有债务",
    unit: "万亿美元",
    source: "FRED FYGFDPUN / U.S. Treasury Fiscal Service",
    sourceUrl: "https://fred.stlouisfed.org/series/FYGFDPUN",
    scale: 1 / 1_000_000,
    color: "#2563eb",
    description: "公众持有债务代表政府账户之外投资者持有的美国联邦债务。"
  },
  {
    key: "debtToGdp",
    fredId: "GFDEGDQ188S",
    label: "债务/GDP",
    unit: "%",
    source: "FRED GFDEGDQ188S",
    sourceUrl: "https://fred.stlouisfed.org/series/GFDEGDQ188S",
    scale: 1,
    color: "#dc2626",
    description: "联邦总债务相对 GDP 的比例，用于观察财政杠杆的宏观压力。"
  },
  {
    key: "interestPayments",
    fredId: "A091RC1Q027SBEA",
    label: "联邦利息支出",
    unit: "万亿美元年化",
    source: "FRED A091RC1Q027SBEA / BEA",
    sourceUrl: "https://fred.stlouisfed.org/series/A091RC1Q027SBEA",
    scale: 1 / 1_000,
    color: "#7c3aed",
    description: "联邦政府利息支付，按年化季度口径观察债务服务成本。"
  },
  {
    key: "dgs3mo",
    fredId: "DGS3MO",
    label: "3M",
    unit: "%",
    source: "FRED DGS3MO / Federal Reserve H.15",
    sourceUrl: "https://fred.stlouisfed.org/series/DGS3MO",
    scale: 1,
    color: "#0f766e",
    description: "3 个月美国国债收益率，代表现金和 T-bill 端的无风险收益。"
  },
  {
    key: "dgs2",
    fredId: "DGS2",
    label: "2Y",
    unit: "%",
    source: "FRED DGS2 / Federal Reserve H.15",
    sourceUrl: "https://fred.stlouisfed.org/series/DGS2",
    scale: 1,
    color: "#2563eb",
    description: "2 年期美国国债收益率，对政策利率预期最敏感。"
  },
  {
    key: "dgs10",
    fredId: "DGS10",
    label: "10Y",
    unit: "%",
    source: "FRED DGS10 / Federal Reserve H.15",
    sourceUrl: "https://fred.stlouisfed.org/series/DGS10",
    scale: 1,
    color: "#dc2626",
    description: "10 年期美国国债收益率，是全球风险资产折现率的重要锚。"
  },
  {
    key: "dgs30",
    fredId: "DGS30",
    label: "30Y",
    unit: "%",
    source: "FRED DGS30 / Federal Reserve H.15",
    sourceUrl: "https://fred.stlouisfed.org/series/DGS30",
    scale: 1,
    color: "#7c3aed",
    description: "30 年期美国国债收益率，反映长期通胀、期限溢价和财政供给压力。"
  },
  {
    key: "t10y2y",
    fredId: "T10Y2Y",
    label: "10Y-2Y",
    unit: "pct",
    source: "FRED T10Y2Y",
    sourceUrl: "https://fred.stlouisfed.org/series/T10Y2Y",
    scale: 1,
    color: "#f59e0b",
    description: "10 年期减 2 年期收益率利差，衡量收益率曲线倒挂和再陡峭化。"
  },
  {
    key: "t10y3m",
    fredId: "T10Y3M",
    label: "10Y-3M",
    unit: "pct",
    source: "FRED T10Y3M",
    sourceUrl: "https://fred.stlouisfed.org/series/T10Y3M",
    scale: 1,
    color: "#16a34a",
    description: "10 年期减 3 个月收益率利差，是常见衰退风险观察指标。"
  }
];

const treasuryHolderDefinitions = [
  {
    key: "fedHeldDebt",
    fredId: "FDHBFRBN",
    label: "Federal Reserve Banks",
    unit: "万亿美元",
    source: "FRED FDHBFRBN / U.S. Treasury Fiscal Service",
    sourceUrl: "https://fred.stlouisfed.org/series/FDHBFRBN",
    scale: 1 / 1_000,
    color: "#7c3aed",
    description: "Federal Reserve Banks 持有的联邦债务。"
  },
  {
    key: "privateHeldDebt",
    fredId: "FDHBPIN",
    label: "Private Investors",
    unit: "万亿美元",
    source: "FRED FDHBPIN / U.S. Treasury Fiscal Service",
    sourceUrl: "https://fred.stlouisfed.org/series/FDHBPIN",
    scale: 1 / 1_000,
    color: "#2563eb",
    description: "私人投资者持有的联邦债务；后续会扣除海外/国际投资者，得到美国国内私人部门近似值。"
  },
  {
    key: "foreignHeldDebt",
    fredId: "FDHBFIN",
    label: "Foreign and International Investors",
    unit: "万亿美元",
    source: "FRED FDHBFIN / U.S. Treasury Fiscal Service",
    sourceUrl: "https://fred.stlouisfed.org/series/FDHBFIN",
    scale: 1 / 1_000,
    color: "#dc2626",
    description: "海外和国际投资者持有的联邦债务。"
  }
];

async function fetchFredSeries({ fredId, scale, start = startIso }) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${fredId}&cosd=${start}`;
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
      const value = raw?.trim();
      const numeric = Number(value);
      if (!date || !value || value === "." || Number.isNaN(numeric)) return null;
      return { date, value: round(numeric * scale, 4) };
    })
    .filter(Boolean);
}

async function fetchJapanCpiSeries() {
  const url = "https://www.e-stat.go.jp/en/stat-search/file-download?fileKind=1&statInfId=000032103842";
  const response = await fetch(url, {
    headers: { "user-agent": "global-liquidity-monitor/0.1" }
  });
  if (!response.ok) {
    throw new Error(`e-Stat Japan CPI failed: ${response.status} ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  const csv = new TextDecoder("shift_jis").decode(buffer);
  return csv
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const columns = line.split(",");
      const period = columns[0];
      const raw = columns[1];
      if (!/^\d{6}$/.test(period) || !raw) return null;
      const numeric = Number(raw);
      if (Number.isNaN(numeric)) return null;
      const date = `${period.slice(0, 4)}-${period.slice(4, 6)}-01`;
      return { date, value: round(numeric, 4) };
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
    .filter((point) => point && point.date >= startIso);
}

async function fetchYahooSeries({ yahooSymbol, scale }) {
  const period1 = Math.floor(startDate.getTime() / 1000);
  const period2 = Math.floor(new Date(endIso).getTime() / 1000) + 86400;
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    yahooSymbol
  )}?period1=${period1}&period2=${period2}&interval=1d&events=history`;
  const { stdout } = await execFileAsync("curl", ["-fsSL", url, "-H", "User-Agent: Mozilla/5.0"], {
    maxBuffer: 8 * 1024 * 1024
  });
  const payload = JSON.parse(stdout);
  const result = payload.chart?.result?.[0];
  if (!result) {
    throw new Error(`Yahoo ${yahooSymbol} failed: ${payload.chart?.error?.description ?? "no result"}`);
  }
  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];

  return timestamps
    .map((timestamp, index) => {
      const value = closes[index];
      if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
      return { date: new Date(timestamp * 1000).toISOString().slice(0, 10), value: round(Number(value) * scale, 4) };
    })
    .filter((point) => point && point.date >= startIso);
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

function yearOverYear(series) {
  const map = byDate(series);
  return series
    .map((point) => {
      const previous = map.get(offsetMonths(point.date, -12));
      if (!previous || previous === 0) return null;
      return { date: point.date, value: round((point.value / previous - 1) * 100, 4) };
    })
    .filter((point) => point && point.date >= startIso);
}

function realPolicyRate(policyRateSeries, inflationSeries) {
  const policyMap = byDate(policyRateSeries);
  return inflationSeries
    .map((point) => {
      const policyRate = latestBeforeOrOn(policyMap, point.date);
      if (policyRate === undefined) return null;
      return { date: point.date, value: round(policyRate - point.value, 4) };
    })
    .filter(Boolean);
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

function offsetMonths(date, months) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCMonth(parsed.getUTCMonth() + months);
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
  await writeDataset("risk-markets.json", await buildRiskDataset());
  await writeDataset("treasury-markets.json", await buildTreasuryDataset());
}

async function fetchSeriesForDefinitions(definitionsForFetch) {
  const entries = await Promise.all(
    definitionsForFetch
      .filter((definition) => definition.fredId || definition.bojCode || definition.yahooSymbol)
      .map(async (definition) => [
        definition.key,
        definition.fredId
          ? await fetchFredSeries(definition)
          : definition.bojCode
            ? await fetchBojSeries(definition)
            : await fetchYahooSeries(definition)
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

function usdInflationCharts(rateSeriesMap, inflationSeriesMap) {
  const cpiYoy = inflationSeriesMap.get("usCpiYoy") ?? [];
  const realEffr = realPolicyRate(rateSeriesMap.get("effr") ?? [], cpiYoy);
  return [
    {
      title: "美国通胀与实际政策利率",
      description: "美国 CPI 同比与 EFFR 扣除 CPI 同比后的实际政策利率。实际政策利率使用常见口径：名义政策利率 - 通胀同比。",
      series: [
        {
          key: "usCpiYoy",
          label: "美国 CPI同比",
          color: "#dc2626",
          unit: "%",
          source: usdInflationDefinitions[0].source,
          sourceUrl: usdInflationDefinitions[0].sourceUrl,
          description: usdInflationDefinitions[0].description,
          points: cpiYoy
        },
        {
          key: "usRealEffr",
          label: "实际政策利率（EFFR-CPI）",
          color: "#2563eb",
          unit: "%",
          source: "FRED EFFR, CPIAUCSL",
          sourceUrl: "https://fred.stlouisfed.org/series/EFFR",
          description: "使用 EFFR 减去美国 CPI 同比，观察扣除通胀后的短端美元政策利率。",
          points: realEffr
        }
      ]
    }
  ];
}

function jpyInflationCharts(rateSeriesMap, inflationSeriesMap) {
  const cpiYoy = inflationSeriesMap.get("japanCpiYoy") ?? [];
  const realCallRate = realPolicyRate(rateSeriesMap.get("jpyCallAverage") ?? [], cpiYoy);
  return [
    {
      title: "日本通胀与实际政策利率",
      description: "日本 CPI 同比与 BOJ 无担保隔夜拆借平均利率扣除 CPI 同比后的实际政策利率。",
      series: [
        {
          key: "japanCpiYoy",
          label: "日本 CPI同比",
          color: "#dc2626",
          unit: "%",
          source: jpyInflationDefinitions[0].source,
          sourceUrl: jpyInflationDefinitions[0].sourceUrl,
          description: jpyInflationDefinitions[0].description,
          points: cpiYoy
        },
        {
          key: "japanRealCallRate",
          label: "实际政策利率（隔夜利率-CPI）",
          color: "#2563eb",
          unit: "%",
          source: "BOJ FM01 STRDCLUCON, e-Stat CPI",
          sourceUrl: "https://www.boj.or.jp/en/statistics/market/short/mutan/index.htm",
          description: "使用 BOJ 无担保隔夜拆借平均利率减去日本 CPI 同比，观察扣除通胀后的短端日元政策利率。",
          points: realCallRate
        }
      ]
    }
  ];
}

function normalizeToFirst(series) {
  const first = series.find((point) => point.value !== 0);
  if (!first) return [];
  return series.map((point) => ({ date: point.date, value: round((point.value / first.value) * 100, 4) }));
}

function riskMarketCharts(seriesMap) {
  return riskDefinitions.map((definition) => ({
    title: `${definition.label} 价格变化`,
    description: `${definition.description} 曲线按该资产首个可用日期归一为 100，使用独立纵轴显示自身波动。`,
    series: [
      {
        key: definition.key,
        label: definition.label,
        color: definition.color,
        unit: definition.unit,
        source: definition.source,
        sourceUrl: definition.sourceUrl,
        description: definition.description,
        points: normalizeToFirst(seriesMap.get(definition.key) ?? [])
      }
    ]
  }));
}

function treasurySeries(definition, seriesMap) {
  return {
    key: definition.key,
    label: definition.label,
    color: definition.color,
    unit: definition.unit,
    source: definition.source,
    sourceUrl: definition.sourceUrl,
    description: definition.description,
    points: [...(seriesMap.get(definition.key) ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  };
}

function treasuryDefinition(key) {
  const definition = treasuryDefinitions.find((item) => item.key === key);
  if (!definition) throw new Error(`Missing treasury definition: ${key}`);
  return definition;
}

function treasuryMarketCharts(seriesMap) {
  return [
    {
      title: "美国联邦债务规模",
      description: "联邦总债务与公众持有债务都按万亿美元展示，用于观察财政供给压力和市场需要吸收的国债规模。",
      series: [
        treasurySeries(treasuryDefinition("totalPublicDebt"), seriesMap),
        treasurySeries(treasuryDefinition("debtHeldByPublic"), seriesMap)
      ]
    },
    {
      title: "联邦债务/GDP",
      description: "总债务相对 GDP 的比例越高，市场越容易关注财政可持续性、期限溢价和长期国债供给压力。",
      series: [treasurySeries(treasuryDefinition("debtToGdp"), seriesMap)]
    },
    {
      title: "联邦政府利息支出",
      description: "利息支出上行代表高利率逐步传导到财政现金流，影响赤字、发债需求和长期期限溢价。",
      series: [treasurySeries(treasuryDefinition("interestPayments"), seriesMap)]
    },
    {
      title: "美债长短端收益率",
      description: "3M、2Y、10Y、30Y 同图观察政策利率、增长预期、通胀预期和期限溢价的相对变化。",
      series: [
        treasurySeries(treasuryDefinition("dgs3mo"), seriesMap),
        treasurySeries(treasuryDefinition("dgs2"), seriesMap),
        treasurySeries(treasuryDefinition("dgs10"), seriesMap),
        treasurySeries(treasuryDefinition("dgs30"), seriesMap)
      ]
    },
    {
      title: "收益率曲线利差",
      description: "10Y-2Y 与 10Y-3M 利差用于观察倒挂、再陡峭化和衰退定价节奏。",
      series: [
        treasurySeries(treasuryDefinition("t10y2y"), seriesMap),
        treasurySeries(treasuryDefinition("t10y3m"), seriesMap)
      ]
    }
  ];
}

function latestPoint(series) {
  return [...series].sort((a, b) => a.date.localeCompare(b.date)).at(-1) ?? null;
}

function treasuryHolderShares(seriesMap) {
  const fed = seriesMap.get("fedHeldDebt") ?? [];
  const privateInvestors = seriesMap.get("privateHeldDebt") ?? [];
  const foreignInvestors = seriesMap.get("foreignHeldDebt") ?? [];
  const latestDates = [latestPoint(fed), latestPoint(privateInvestors), latestPoint(foreignInvestors)]
    .map((point) => point?.date)
    .filter(Boolean)
    .sort();
  const date = latestDates[0];
  if (!date) return [];

  const fedValue = latestBeforeOrOn(byDate(fed), date);
  const privateValue = latestBeforeOrOn(byDate(privateInvestors), date);
  const foreignValue = latestBeforeOrOn(byDate(foreignInvestors), date);
  if (fedValue === undefined || privateValue === undefined || foreignValue === undefined) return [];

  const domesticPrivateValue = Math.max(privateValue - foreignValue, 0);
  return [
    {
      key: "domesticPrivate",
      label: "美国国内私人部门",
      value: round(domesticPrivateValue, 3),
      unit: "万亿美元",
      color: "#2563eb",
      source: "FRED FDHBPIN - FDHBFIN",
      sourceUrl: "https://fredblog.stlouisfed.org/2025/03/who-holds-us-national-debt/",
      date
    },
    {
      key: "foreignInvestors",
      label: "海外与国际投资者",
      value: round(foreignValue, 3),
      unit: "万亿美元",
      color: "#dc2626",
      source: "FRED FDHBFIN",
      sourceUrl: "https://fred.stlouisfed.org/series/FDHBFIN",
      date
    },
    {
      key: "fedBanks",
      label: "Federal Reserve Banks",
      value: round(fedValue, 3),
      unit: "万亿美元",
      color: "#7c3aed",
      source: "FRED FDHBFRBN",
      sourceUrl: "https://fred.stlouisfed.org/series/FDHBFRBN",
      date
    }
  ];
}

async function buildUsdDataset() {
  const seriesMap = await fetchSeriesForDefinitions(usdDefinitions);
  const rateSeriesMap = await fetchSeriesForDefinitions(usdRateDefinitions);
  const inflationSeriesMap = await fetchSeriesForDefinitions(
    usdInflationDefinitions.map((definition) => ({ ...definition, start: inflationStartIso }))
  );
  inflationSeriesMap.set("usCpiYoy", yearOverYear(inflationSeriesMap.get("usCpiIndex") ?? []));

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
    dateRange: {
      start: startIso,
      end: endIso
    },
    indicators: stripInternalFields(visibleDefinitions),
    snapshots,
    rateCharts: usdRateCharts(rateSeriesMap),
    inflationCharts: usdInflationCharts(rateSeriesMap, inflationSeriesMap),
    composite: {
      score: latestComposite?.value ?? null,
      label: labelForScore(latestComposite?.value ?? null),
      date: latestComposite?.date ?? null,
      series: composite
    },
    notes: [
      "FRED CSV 在构建阶段抓取，前端只读取本仓库生成的 JSON，避免 GitHub Pages 运行时跨域和限流问题。",
      "美国通胀使用 FRED CPIAUCSL 月度指数计算同比；实际政策利率使用 EFFR - CPI同比。",
      "净流动性采用近似口径：Fed 总资产 - TGA - ON RRP；不同机构可能使用准备金、财政现金和 RRP 的不同组合。",
      "综合评分使用各指标十年历史 Z-score 的方向化加权值，转换为 0-100 区间；它是监控仪表盘，不是投资建议。"
    ]
  };
}

async function buildJpyDataset() {
  const seriesMap = await fetchSeriesForDefinitions(jpyDefinitions);
  const rateSeriesMap = await fetchSeriesForDefinitions(jpyRateDefinitions);
  const inflationSeriesMap = new Map();
  inflationSeriesMap.set("japanCpiIndex", (await fetchJapanCpiSeries()).filter((point) => point.date >= inflationStartIso));
  inflationSeriesMap.set("japanCpiYoy", yearOverYear(inflationSeriesMap.get("japanCpiIndex") ?? []));
  const visibleDefinitions = [...jpyDefinitions].sort((a, b) => b.weight - a.weight);
  const snapshots = visibleDefinitions.map((definition) => snapshot(definition, seriesMap.get(definition.key) ?? []));
  const composite = compositeSeries(visibleDefinitions, snapshots);
  const latestComposite = composite.at(-1) ?? null;

  return {
    generatedAt: new Date().toISOString(),
    lookbackYears,
    dateRange: {
      start: startIso,
      end: endIso
    },
    indicators: stripInternalFields(visibleDefinitions),
    snapshots,
    rateCharts: jpyRateCharts(rateSeriesMap),
    inflationCharts: jpyInflationCharts(rateSeriesMap, inflationSeriesMap),
    composite: {
      score: latestComposite?.value ?? null,
      label: labelForScore(latestComposite?.value ?? null),
      date: latestComposite?.date ?? null,
      series: composite
    },
    notes: [
      "BOJ 官方 Time-Series Data Search API 在构建阶段抓取货币基础、当座存款、准备金、M2 与广义定义流动性 L。",
      "日本通胀使用 e-Stat/总务省统计局 2020 基准全国 CPI All items 月度指数计算同比；实际政策利率使用 BOJ 无担保隔夜拆借平均利率 - CPI同比。",
      "BOJ 总资产、USD/JPY 和日本 10 年期国债收益率使用 FRED 无密钥 CSV 序列；其中 BOJ 总资产的原始来源仍为 Bank of Japan Accounts。",
      "日元综合评分同样使用十年 Z-score 方向化加权。货币量、准备金和 USD/JPY 上升按偏宽松处理，JGB 10Y 上升按偏收紧处理。"
    ]
  };
}

async function buildRiskDataset() {
  const seriesMap = await fetchSeriesForDefinitions(riskDefinitions);
  return {
    generatedAt: new Date().toISOString(),
    lookbackYears,
    dateRange: {
      start: startIso,
      end: endIso
    },
    indicators: [],
    snapshots: [],
    riskCharts: riskMarketCharts(seriesMap),
    composite: {
      score: null,
      label: "风险市场",
      date: endIso,
      series: []
    },
    notes: [
      "风险市场页使用归一化价格曲线，不参与美元或日元流动性评分。",
      "BTC 和纳斯达克综合指数来自 FRED；恒生科技指数使用可自动更新的 3033.HK ETF 作为跟踪代理。"
    ]
  };
}

async function buildTreasuryDataset() {
  const seriesMap = await fetchSeriesForDefinitions(treasuryDefinitions);
  const holderSeriesMap = await fetchSeriesForDefinitions(treasuryHolderDefinitions);
  const charts = treasuryMarketCharts(seriesMap);
  const holderShares = treasuryHolderShares(holderSeriesMap);
  const latestDebt = latestPoint(seriesMap.get("totalPublicDebt") ?? []);
  return {
    generatedAt: new Date().toISOString(),
    lookbackYears,
    dateRange: {
      start: startIso,
      end: endIso
    },
    indicators: [],
    snapshots: [],
    treasuryCharts: charts,
    holderShares,
    composite: {
      score: null,
      label: "美债市场",
      date: latestDebt?.date ?? endIso,
      series: []
    },
    notes: [
      "美债页使用 FRED 无密钥 CSV 抓取，总债务、公众持有债务和持有人结构的原始来源为 U.S. Treasury Fiscal Service。",
      "持有人饼图采用公众持有债务近似拆分：美国国内私人部门 = Private Investors - Foreign and International Investors；另列海外/国际投资者与 Federal Reserve Banks。",
      "收益率曲线使用 Federal Reserve H.15 的 3M、2Y、10Y、30Y 常数期限美债收益率；利差使用 FRED T10Y2Y 与 T10Y3M。"
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
