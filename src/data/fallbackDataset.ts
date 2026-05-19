import type { LiquidityDataset } from "../types/liquidity";

export const fallbackDataset: LiquidityDataset = {
  generatedAt: "2026-05-19T00:00:00.000Z",
  lookbackYears: 10,
  dateRange: {
    start: "2016-05-19",
    end: "2026-05-19"
  },
  indicators: [
    {
      key: "fedBalanceSheet",
      name: "美联储资产负债表规模",
      shortName: "Fed 总资产",
      group: "政策与准备金",
      unit: "万亿美元",
      source: "FRED WALCL",
      sourceUrl: "https://fred.stlouisfed.org/series/WALCL",
      direction: "up_is_looser",
      weight: 0.18,
      description: "Fed 资产扩张通常释放基础流动性，缩表则减少系统准备金。"
    },
    {
      key: "tga",
      name: "美国财政部一般账户余额",
      shortName: "TGA",
      group: "政策与准备金",
      unit: "万亿美元",
      source: "FRED WTREGEN",
      sourceUrl: "https://fred.stlouisfed.org/series/WTREGEN",
      direction: "up_is_tighter",
      weight: 0.14,
      description: "TGA 上升代表资金进入财政部账户，通常从银行准备金体系抽水。"
    },
    {
      key: "onRrp",
      name: "隔夜逆回购余额",
      shortName: "ON RRP",
      group: "政策与准备金",
      unit: "万亿美元",
      source: "FRED RRPONTSYD",
      sourceUrl: "https://fred.stlouisfed.org/series/RRPONTSYD",
      direction: "up_is_tighter",
      weight: 0.12,
      description: "货币基金停放在 ON RRP 的规模越大，留在市场内的可用流动性越少。"
    },
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
      key: "m2",
      name: "M2 货币供应量",
      shortName: "M2",
      group: "广义流动性",
      unit: "万亿美元",
      source: "FRED WM2NS",
      sourceUrl: "https://fred.stlouisfed.org/series/WM2NS",
      direction: "up_is_looser",
      weight: 0.1,
      description: "广义货币扩张对风险资产和信用环境形成中周期支持。"
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
    },
    {
      key: "srf",
      name: "常备回购便利使用量",
      shortName: "SRF",
      group: "融资与管道",
      unit: "十亿美元",
      source: "NY Fed SRF",
      sourceUrl: "https://www.newyorkfed.org/markets/standing-repo-facility",
      direction: "up_is_tighter",
      weight: 0.06,
      description: "SRF 使用量异常上升代表市场需要向 Fed 借入流动性。"
    },
    {
      key: "vix",
      name: "VIX 波动率指数",
      shortName: "VIX",
      group: "风险与价格",
      unit: "点",
      source: "FRED VIXCLS",
      sourceUrl: "https://fred.stlouisfed.org/series/VIXCLS",
      direction: "up_is_tighter",
      weight: 0.06,
      description: "波动率上升会压缩风险预算，放大去杠杆压力。"
    },
    {
      key: "hyOas",
      name: "高收益债信用利差",
      shortName: "HY OAS",
      group: "信用与中介",
      unit: "bp",
      source: "FRED BAMLH0A0HYM2",
      sourceUrl: "https://fred.stlouisfed.org/series/BAMLH0A0HYM2",
      direction: "up_is_tighter",
      weight: 0.06,
      description: "信用利差扩张说明融资条件收紧，风险资产贴现率上升。"
    },
    {
      key: "broadDollar",
      name: "广义美元指数",
      shortName: "美元指数",
      group: "风险与价格",
      unit: "指数",
      source: "FRED DTWEXBGS",
      sourceUrl: "https://fred.stlouisfed.org/series/DTWEXBGS",
      direction: "up_is_tighter",
      weight: 0.06,
      description: "美元走强通常收紧离岸美元融资和全球风险偏好。"
    },
    {
      key: "realYield10y",
      name: "10Y 实际利率",
      shortName: "10Y TIPS",
      group: "风险与价格",
      unit: "%",
      source: "FRED DFII10",
      sourceUrl: "https://fred.stlouisfed.org/series/DFII10",
      direction: "up_is_tighter",
      weight: 0.06,
      description: "实际利率越高，远期现金流和高久期资产的估值压力越大。"
    }
  ],
  snapshots: [],
  composite: {
    score: null,
    label: "等待数据更新",
    date: null,
    series: []
  },
  notes: ["当前展示为数据结构备用样例。运行 npm run update:data 可从公开数据源生成最新快照。"]
};
