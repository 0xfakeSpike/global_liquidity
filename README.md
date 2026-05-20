# Global Liquidity Monitor

React + Vite implementation of a global liquidity monitoring terminal inspired by DollarLiquidity-style indicator pages. It currently includes parallel USD and JPY liquidity pages.

## Data Sources

The app does not fetch macro data from the browser. `scripts/fetch-data.mjs` pulls public data at build time and writes:

- `public/data/liquidity.json` for USD liquidity
- `public/data/yen-liquidity.json` for JPY liquidity
- `public/data/risk-markets.json` for normalized risk-market prices
- `public/data/treasury-markets.json` for U.S. Treasury debt, ownership, yield curve, and fiscal interest cost charts

USD primary series:

- FRED `WALCL`: Fed balance sheet total assets
- FRED `WTREGEN`: Treasury General Account
- FRED `RRPONTSYD`: overnight reverse repo
- FRED `RPONTSYD`: standing repo facility usage, sourced from NY Fed repo operations through FRED
- FRED `SOFR` and `IORB`: SOFR-IORB spread
- FRED `WM2NS`, `VIXCLS`, `BAMLH0A0HYM2`, `DTWEXBGS`, `DFII10`
- FRED `EFFR`, `DFEDTARL`, `DFEDTARU`, `IORB`, `SOFR`: Fed rate curves
- FRED `CPIAUCSL`: U.S. CPI-U All Items index, used to calculate CPI year-over-year inflation

Derived series:

- Net liquidity = `WALCL - WTREGEN - RRPONTSYD`
- U.S. real policy rate = `EFFR - CPI YoY`
- Composite DLI score = direction-adjusted 10-year z-score weighted index, converted to a 0-100 range

JPY primary series:

- FRED `JPNASSETS`: Bank of Japan total assets
- BOJ API `MD01/MABS1AN11`: monetary base
- BOJ API `MD01/MABS1AN113`: current account balances at the BOJ
- BOJ API `MD01/MABS1AN114`: reserve balances
- BOJ API `MD02/MAM1NAM2M2MO`: M2 money stock
- BOJ API `MD02/MAM1NABLBLMO`: broadly-defined liquidity `L`
- BOJ API `FM01/STRDCLUCON`, `STRDCLUCONH`, `STRDCLUCONL`: uncollateralized overnight call rate curves
- BOJ API `IR01/MADR1Z@D`: basic discount rate and basic loan rate
- FRED `IRLTLT01JPM156N`: Japan 10-year government bond yield
- FRED `DEXJPUS`: USD/JPY exchange rate
- e-Stat / Statistics Bureau of Japan CPI 2020-base: Japan All items CPI index, used to calculate CPI year-over-year inflation

JPY derived series:

- Japan real policy rate = `BOJ uncollateralized overnight call average - CPI YoY`

Risk market series:

- FRED `CBBTCUSD`: Bitcoin price
- FRED `NASDAQCOM`: Nasdaq Composite Index
- Yahoo Finance `3033.HK`: CSOP Hang Seng TECH Index ETF, used as a Hang Seng TECH tracking proxy

Risk market charts use one independent y-axis per asset and a shared 10-year x-axis.

U.S. Treasury market series:

- FRED `GFDEBTN`: federal total public debt
- FRED `FYGFDPUN`: federal debt held by the public
- FRED `GFDEGDQ188S`: federal debt as percent of GDP
- FRED `A091RC1Q027SBEA`: federal government interest payments
- FRED `DGS3MO`, `DGS2`, `DGS10`, `DGS30`: Treasury constant maturity yields
- FRED `T10Y2Y`, `T10Y3M`: yield curve spreads
- FRED `FDHBFRBN`, `FDHBPIN`, `FDHBFIN`: Treasury holder structure. The holder pie approximates domestic private ownership as `FDHBPIN - FDHBFIN`, then separately shows foreign/international investors and Federal Reserve Banks.
- Treasury TIC Table 5 `slt_table5.txt`: latest major foreign holders by country/region, including Japan, Mainland China, United Kingdom, Cayman Islands, Belgium, and others. TIC country data are reported by custody/reporting location and may not identify the final beneficial owner.

## Local Development

```bash
npm install
npm run dev
```

Update data manually:

```bash
npm run update:data
```

Build:

```bash
npm run build
```

## GitHub Pages

`.github/workflows/pages.yml` builds on every `main` push, weekdays by schedule, and manual dispatch. It sets `GITHUB_PAGES=true` so Vite uses `/global_liquidity/` as the base path.

Enable Pages in GitHub repository settings with source set to **GitHub Actions**.
