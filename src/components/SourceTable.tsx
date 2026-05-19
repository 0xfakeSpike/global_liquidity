import type { IndicatorDefinition } from "../types/liquidity";

interface SourceTableProps {
  indicators: IndicatorDefinition[];
}

export function SourceTable({ indicators }: SourceTableProps) {
  return (
    <section className="source-section">
      <div className="section-heading">
        <p>Data Sources</p>
        <h2>数据口径与来源</h2>
      </div>
      <div className="source-table">
        {indicators.map((item) => (
          <a href={item.sourceUrl} key={item.key} target="_blank" rel="noreferrer">
            <span>{item.shortName}</span>
            <strong>{item.source}</strong>
            <em>{item.formula ?? item.description}</em>
          </a>
        ))}
      </div>
    </section>
  );
}
