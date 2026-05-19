# Global Liquidity Monitor

React + Vite implementation of a global liquidity monitoring terminal inspired by DollarLiquidity-style indicator pages. It currently includes parallel USD and JPY liquidity pages.

## Data Sources

The app does not fetch macro data from the browser. `scripts/fetch-data.mjs` pulls public data at build time and writes:

- `public/data/liquidity.json` for USD liquidity
- `public/data/yen-liquidity.json` for JPY liquidity

USD primary series:

- FRED `WALCL`: Fed balance sheet total assets
- FRED `WTREGEN`: Treasury General Account
- FRED `RRPONTSYD`: overnight reverse repo
- FRED `RPONTSYD`: standing repo facility usage, sourced from NY Fed repo operations through FRED
- FRED `SOFR` and `IORB`: SOFR-IORB spread
- FRED `WM2NS`, `VIXCLS`, `BAMLH0A0HYM2`, `DTWEXBGS`, `DFII10`

Derived series:

- Net liquidity = `WALCL - WTREGEN - RRPONTSYD`
- Composite DLI score = direction-adjusted 10-year z-score weighted index, converted to a 0-100 range

JPY primary series:

- FRED `JPNASSETS`: Bank of Japan total assets
- BOJ API `MD01/MABS1AN11`: monetary base
- BOJ API `MD01/MABS1AN113`: current account balances at the BOJ
- BOJ API `MD01/MABS1AN114`: reserve balances
- BOJ API `MD02/MAM1NAM2M2MO`: M2 money stock
- BOJ API `MD02/MAM1NABLBLMO`: broadly-defined liquidity `L`
- FRED `IRLTLT01JPM156N`: Japan 10-year government bond yield
- FRED `DEXJPUS`: USD/JPY exchange rate

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
