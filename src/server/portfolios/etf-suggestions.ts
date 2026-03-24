import yahooFinance from "yahoo-finance2";

export type ETFSuggestion = {
  ticker: string;
  name: string;
  expenseRatio: number | null;    // decimal e.g. 0.0003 = 0.03%
  threeYearReturn: number | null; // decimal e.g. 0.12 = 12%
  assetClass: "equity" | "bond" | "alt";
  justification: string;
};

// Curated seed lists per asset class
const SEEDS: Record<"equity" | "bond" | "alt", string[]> = {
  equity: ["VTI", "ITOT", "SCHB", "IVV", "VOO"],
  bond:   ["BND", "AGG", "SCHZ", "VGIT", "FBND"],
  alt:    ["VNQ", "SCHH", "IAU", "PDBC", "GLD"],
};

const CLASS_LABELS: Record<"equity" | "bond" | "alt", string> = {
  equity: "broad US equity",
  bond:   "investment-grade bonds",
  alt:    "real assets / alternatives",
};

async function fetchQuote(ticker: string) {
  try {
    const q = await yahooFinance.quote(ticker, { fields: ["longName", "shortName", "trailingAnnualReturnRate3Year", "annualReportExpenseRatio"] });
    return q;
  } catch {
    return null;
  }
}

function score(expenseRatio: number | null, ret3yr: number | null): number {
  const r = ret3yr ?? 0;
  const e = expenseRatio ?? 0.01;
  return r * 0.6 - e * 1000 * 0.4;
}

export async function fetchETFSuggestions(
  underweightClasses: Array<"equity" | "bond" | "alt">
): Promise<ETFSuggestion[]> {
  if (underweightClasses.length === 0) return [];

  const results: ETFSuggestion[] = [];

  for (const assetClass of underweightClasses) {
    const tickers = SEEDS[assetClass];
    const quotes = await Promise.all(tickers.map(fetchQuote));

    // Score and pick top 2
    const scored = tickers
      .map((ticker, i) => ({ ticker, q: quotes[i] }))
      .filter(({ q }) => q !== null)
      .map(({ ticker, q }) => {
        // yahoo-finance2 field names vary; try common ones
        const expRatio: number | null =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (q as any).annualReportExpenseRatio ?? null;
        const ret3yr: number | null =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (q as any).trailingAnnualReturnRate3Year ?? null;
        const name: string =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (q as any).longName ?? (q as any).shortName ?? ticker;
        return { ticker, name, expRatio, ret3yr, s: score(expRatio, ret3yr) };
      })
      .sort((a, b) => b.s - a.s)
      .slice(0, 2);

    for (const item of scored) {
      results.push({
        ticker: item.ticker,
        name: item.name,
        expenseRatio: item.expRatio,
        threeYearReturn: item.ret3yr,
        assetClass,
        justification: `Low-cost ${CLASS_LABELS[assetClass]} ETF selected for cost efficiency and diversification.`,
      });
    }
  }

  return results;
}
