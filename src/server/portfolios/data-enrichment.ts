import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export type MarketData = {
  ticker: string;
  securityName: string;
  expenseRatio: number | null;
  netExpenseRatio: number | null;
  category: string | null;
  fundFamily: string | null;
  ytdReturn: number | null;
  oneYearReturn: number | null;
  threeYearReturn: number | null;
  fiveYearReturn: number | null;
  morningStarRating: number | null;
  analystBuy: number | null;
  analystHold: number | null;
  analystSell: number | null;
  topHoldings: Array<{ symbol: string | null; name: string; percent: number }>;
};

export type Alternative = MarketData & {
  similarityScore: number;
};

export type EnrichedHolding<T> = T & {
  marketData: MarketData | null;
  alternatives: Alternative[];
};

async function fetchMarketData(ticker: string): Promise<MarketData | null> {
  try {
    const summary = await yahooFinance.quoteSummary(ticker, {
      modules: ["summaryDetail", "fundProfile", "topHoldings", "fundPerformance", "recommendationTrend"],
    });

    const fp = summary.fundProfile as Record<string, unknown> | undefined;
    const perf = summary.fundPerformance as Record<string, unknown> | undefined;
    const th = summary.topHoldings as Record<string, unknown> | undefined;
    const rt = summary.recommendationTrend as Record<string, unknown> | undefined;

    const fees = fp?.feesExpensesInvestment as Record<string, unknown> | undefined;
    const perfOverview = perf?.performanceOverview as Record<string, unknown> | undefined;
    const holdings = (th?.holdings as Array<Record<string, unknown>> | undefined) ?? [];
    const trends = (rt?.trend as Array<Record<string, unknown>> | undefined) ?? [];
    const trend = trends[0];

    return {
      ticker: ticker.toUpperCase(),
      securityName: ticker.toUpperCase(),
      expenseRatio:
        fees?.annualReportExpenseRatio != null ? Number(fees.annualReportExpenseRatio) : null,
      netExpenseRatio:
        fees?.netExpRatio != null ? Number(fees.netExpRatio) : null,
      category: fp?.categoryName != null ? String(fp.categoryName) : null,
      fundFamily: fp?.family != null ? String(fp.family) : null,
      ytdReturn:
        perfOverview?.ytdReturnPct != null ? Number(perfOverview.ytdReturnPct) : null,
      oneYearReturn:
        perfOverview?.oneYearTotalReturn != null ? Number(perfOverview.oneYearTotalReturn) : null,
      threeYearReturn:
        perfOverview?.threeYearTotalReturn != null ? Number(perfOverview.threeYearTotalReturn) : null,
      fiveYearReturn:
        perfOverview?.fiveYrAvgReturnPct != null ? Number(perfOverview.fiveYrAvgReturnPct) : null,
      morningStarRating:
        perfOverview?.morningStarReturnRating != null
          ? Number(perfOverview.morningStarReturnRating)
          : null,
      analystBuy:
        trend != null
          ? ((trend.strongBuy as number | undefined) ?? 0) +
            ((trend.buy as number | undefined) ?? 0)
          : null,
      analystHold: trend != null ? ((trend.hold as number | undefined) ?? 0) : null,
      analystSell:
        trend != null
          ? ((trend.sell as number | undefined) ?? 0) +
            ((trend.strongSell as number | undefined) ?? 0)
          : null,
      topHoldings: holdings.slice(0, 5).map((h) => ({
        symbol: h.symbol != null ? String(h.symbol) : null,
        name: h.holdingName != null ? String(h.holdingName) : "",
        percent: h.holdingPercent != null ? Number(h.holdingPercent) : 0,
      })),
    };
  } catch {
    return null;
  }
}

async function fetchAlternatives(ticker: string): Promise<Alternative[]> {
  try {
    const result = await yahooFinance.recommendationsBySymbol(ticker);
    const recommended = (result as { recommendedSymbols?: Array<{ symbol: string; score: number }> })
      .recommendedSymbols;
    if (!recommended || recommended.length === 0) return [];

    const top5 = recommended.slice(0, 5);
    const settled = await Promise.allSettled(
      top5.map(async ({ symbol, score }) => {
        const data = await fetchMarketData(symbol);
        if (!data) return null;
        return { ...data, similarityScore: score };
      })
    );

    return settled
      .filter(
        (r): r is PromiseFulfilledResult<Alternative> =>
          r.status === "fulfilled" && r.value !== null
      )
      .map((r) => r.value);
  } catch {
    return [];
  }
}

export async function enrichHoldings<
  T extends { ticker: string | null; securityName: string }
>(holdings: T[]): Promise<EnrichedHolding<T>[]> {
  const withTickers = holdings.filter(
    (h): h is T & { ticker: string } => Boolean(h.ticker)
  );

  const settled = await Promise.allSettled(
    withTickers.map(async (h) => {
      const [marketData, alternatives] = await Promise.all([
        fetchMarketData(h.ticker),
        fetchAlternatives(h.ticker),
      ]);
      return { ticker: h.ticker, marketData, alternatives };
    })
  );

  const enrichmentMap = new Map<
    string,
    { marketData: MarketData | null; alternatives: Alternative[] }
  >();
  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      enrichmentMap.set(outcome.value.ticker, {
        marketData: outcome.value.marketData,
        alternatives: outcome.value.alternatives,
      });
    }
  }

  return holdings.map((h) => {
    const enrichment =
      h.ticker != null ? enrichmentMap.get(h.ticker) ?? null : null;
    return {
      ...h,
      marketData: enrichment?.marketData ?? null,
      alternatives: enrichment?.alternatives ?? [],
    };
  });
}
