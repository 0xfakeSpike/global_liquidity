# Global Dollar Liquidity Monitor

React + Vite implementation of a dollar liquidity monitoring terminal inspired by DollarLiquidity-style indicator pages.

## Data Sources

The app does not fetch macro data from the browser. `scripts/fetch-data.mjs` pulls public data at build time and writes `public/data/liquidity.json`.

Primary series:

- FRED `WALCL`: Fed balance sheet total assets
- FRED `WTREGEN`: Treasury General Account
- FRED `RRPONTSYD`: overnight reverse repo
- FRED `RPONTSYD`: standing repo facility usage, sourced from NY Fed repo operations through FRED
- FRED `SOFR` and `IORB`: SOFR-IORB spread
- FRED `WM2NS`, `VIXCLS`, `BAMLH0A0HYM2`, `DTWEXBGS`, `DFII10`

Derived series:

- Net liquidity = `WALCL - WTREGEN - RRPONTSYD`
- Composite DLI score = direction-adjusted 10-year z-score weighted index, converted to a 0-100 range

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
