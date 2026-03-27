import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// ─── Types ────────────────────────────────────────────────────────────────────

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

/** Financial Modeling Prep: Wall Street analyst consensus + key fundamental ratios */
export type FmpData = {
  peRatio: number | null;
  priceToBook: number | null;
  dividendYieldPct: number | null;
  returnOnEquity: number | null;
  debtToEquity: number | null;
  analystStrongBuy: number | null;
  analystBuy: number | null;
  analystHold: number | null;
  analystSell: number | null;
  analystStrongSell: number | null;
  priceTargetConsensus: number | null;
  priceTargetHigh: number | null;
  priceTargetLow: number | null;
};

/** Finnhub: news sentiment + recent headlines */
export type FinnhubData = {
  bullishPercent: number | null;
  bearishPercent: number | null;
  newsScore: number | null;
  recentHeadlines: Array<{ headline: string; source: string; url: string }>;
};

/** Alpha Vantage: news & sentiment from financial media */
export type AlphaVantageData = {
  overallSentimentLabel: string | null;
  overallSentimentScore: number | null;
  headlines: Array<{
    title: string;
    source: string;
    url: string;
    sentimentLabel: string;
    sentimentScore: number;
    relevanceScore: number;
  }>;
};

export type EnrichedHolding<T> = T & {
  marketData: MarketData | null;
  alternatives: Alternative[];
  fmpData: FmpData | null;
  finnhubData: FinnhubData | null;
  alphaVantageData: AlphaVantageData | null;
};

// ─── Yahoo Finance ─────────────────────────────────────────────────────────────

async function fetchMarketData(ticker: string): Promise<MarketData | null> {
  try {
    const summary = await Promise.race([
      yahooFinance.quoteSummary(ticker, {
        modules: ["summaryDetail", "fundProfile", "topHoldings", "fundPerformance", "recommendationTrend"],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Yahoo Finance timeout")), 10_000)
      ),
    ]);

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
    const result = await Promise.race([
      yahooFinance.recommendationsBySymbol(ticker),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Yahoo Finance timeout")), 10_000)
      ),
    ]);
    const recommended = (result as { recommendedSymbols?: Array<{ symbol: string; score: number }> })
      .recommendedSymbols;
    if (!recommended || recommended.length === 0) return [];

    const top3 = recommended.slice(0, 3);
    const settled = await Promise.allSettled(
      top3.map(async ({ symbol, score }) => {
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

// ─── Financial Modeling Prep ──────────────────────────────────────────────────
// Free tier: 250 requests/day — https://financialmodelingprep.com/developer/docs
// API key env var: FMP_API_KEY

async function fetchFmpData(ticker: string): Promise<FmpData | null> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return null;

  const base = "https://financialmodelingprep.com/api/v3";

  try {
    const [ratiosRes, recommendationsRes, priceTargetRes] = await Promise.allSettled([
      fetch(`${base}/ratios-ttm/${encodeURIComponent(ticker)}?apikey=${apiKey}`, { signal: AbortSignal.timeout(8_000) }),
      fetch(`${base}/analyst-stock-recommendations/${encodeURIComponent(ticker)}?limit=1&apikey=${apiKey}`, { signal: AbortSignal.timeout(8_000) }),
      fetch(`${base}/price-target-summary/${encodeURIComponent(ticker)}?apikey=${apiKey}`, { signal: AbortSignal.timeout(8_000) }),
    ]);

    // Financial ratios
    let peRatio: number | null = null;
    let priceToBook: number | null = null;
    let dividendYieldPct: number | null = null;
    let returnOnEquity: number | null = null;
    let debtToEquity: number | null = null;

    if (ratiosRes.status === "fulfilled" && ratiosRes.value.ok) {
      const ratiosJson = (await ratiosRes.value.json()) as Array<Record<string, unknown>>;
      const r = ratiosJson?.[0];
      if (r) {
        peRatio = r.peRatioTTM != null ? Number(r.peRatioTTM) : null;
        priceToBook = r.priceToBookRatioTTM != null ? Number(r.priceToBookRatioTTM) : null;
        dividendYieldPct =
          r.dividendYielPercentageTTM != null ? Number(r.dividendYielPercentageTTM) : null;
        returnOnEquity = r.returnOnEquityTTM != null ? Number(r.returnOnEquityTTM) : null;
        debtToEquity = r.debtEquityRatioTTM != null ? Number(r.debtEquityRatioTTM) : null;
      }
    }

    // Analyst consensus
    let analystStrongBuy: number | null = null;
    let analystBuy: number | null = null;
    let analystHold: number | null = null;
    let analystSell: number | null = null;
    let analystStrongSell: number | null = null;

    if (recommendationsRes.status === "fulfilled" && recommendationsRes.value.ok) {
      const recJson = (await recommendationsRes.value.json()) as Array<Record<string, unknown>>;
      const rec = recJson?.[0];
      if (rec) {
        analystStrongBuy =
          rec.analystRatingsStrongBuy != null ? Number(rec.analystRatingsStrongBuy) : null;
        analystBuy = rec.analystRatingsBuy != null ? Number(rec.analystRatingsBuy) : null;
        analystHold = rec.analystRatingsHold != null ? Number(rec.analystRatingsHold) : null;
        analystSell = rec.analystRatingsSell != null ? Number(rec.analystRatingsSell) : null;
        analystStrongSell =
          rec.analystRatingsStrongSell != null ? Number(rec.analystRatingsStrongSell) : null;
      }
    }

    // Price targets
    let priceTargetConsensus: number | null = null;
    let priceTargetHigh: number | null = null;
    let priceTargetLow: number | null = null;

    if (priceTargetRes.status === "fulfilled" && priceTargetRes.value.ok) {
      const ptRaw = (await priceTargetRes.value.json()) as unknown;
      // FMP v3 price-target-summary returns an array; normalize to single object
      const ptJson = Array.isArray(ptRaw)
        ? (ptRaw[0] as Record<string, unknown> | undefined)
        : (ptRaw as Record<string, unknown> | undefined);
      if (ptJson) {
        priceTargetConsensus =
          ptJson.targetConsensus != null ? Number(ptJson.targetConsensus) : null;
        priceTargetHigh = ptJson.targetHigh != null ? Number(ptJson.targetHigh) : null;
        priceTargetLow = ptJson.targetLow != null ? Number(ptJson.targetLow) : null;
      }
    }

    // Return null if we got nothing useful
    const hasAnyData =
      peRatio != null ||
      analystStrongBuy != null ||
      priceTargetConsensus != null;
    if (!hasAnyData) return null;

    return {
      peRatio,
      priceToBook,
      dividendYieldPct,
      returnOnEquity,
      debtToEquity,
      analystStrongBuy,
      analystBuy,
      analystHold,
      analystSell,
      analystStrongSell,
      priceTargetConsensus,
      priceTargetHigh,
      priceTargetLow,
    };
  } catch {
    return null;
  }
}

// ─── Finnhub ──────────────────────────────────────────────────────────────────
// Free tier: 60 requests/min — https://finnhub.io/docs/api
// API key env var: FINNHUB_API_KEY

async function fetchFinnhubData(ticker: string): Promise<FinnhubData | null> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return null;

  const base = "https://finnhub.io/api/v1";
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  try {
    const [sentimentRes, newsRes] = await Promise.allSettled([
      fetch(`${base}/news-sentiment?symbol=${encodeURIComponent(ticker)}&token=${apiKey}`, { signal: AbortSignal.timeout(8_000) }),
      fetch(
        `${base}/company-news?symbol=${encodeURIComponent(ticker)}&from=${thirtyDaysAgo}&to=${today}&token=${apiKey}`,
        { signal: AbortSignal.timeout(8_000) }
      ),
    ]);

    let bullishPercent: number | null = null;
    let bearishPercent: number | null = null;
    let newsScore: number | null = null;

    if (sentimentRes.status === "fulfilled" && sentimentRes.value.ok) {
      const s = (await sentimentRes.value.json()) as Record<string, unknown>;
      const sentiment = s?.sentiment as Record<string, unknown> | undefined;
      bullishPercent =
        sentiment?.bullishPercent != null ? Number(sentiment.bullishPercent) : null;
      bearishPercent =
        sentiment?.bearishPercent != null ? Number(sentiment.bearishPercent) : null;
      newsScore = s?.companyNewsScore != null ? Number(s.companyNewsScore) : null;
    }

    const recentHeadlines: FinnhubData["recentHeadlines"] = [];

    if (newsRes.status === "fulfilled" && newsRes.value.ok) {
      const articles = (await newsRes.value.json()) as Array<Record<string, unknown>>;
      articles.slice(0, 4).forEach((a) => {
        if (a.headline && a.source) {
          recentHeadlines.push({
            headline: String(a.headline),
            source: String(a.source),
            url: a.url != null ? String(a.url) : "",
          });
        }
      });
    }

    if (bullishPercent == null && recentHeadlines.length === 0) return null;

    return { bullishPercent, bearishPercent, newsScore, recentHeadlines };
  } catch {
    return null;
  }
}

// ─── Alpha Vantage ────────────────────────────────────────────────────────────
// Free tier: 25 requests/day — https://www.alphavantage.co/documentation/
// Provides news sentiment with per-article ticker relevance and sentiment scores
// API key env var: ALPHA_VANTAGE_API_KEY

async function fetchAlphaVantageData(ticker: string): Promise<AlphaVantageData | null> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${encodeURIComponent(ticker)}&limit=5&sort=RELEVANCE&apikey=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;

    const json = (await res.json()) as Record<string, unknown>;

    // Alpha Vantage returns an error key when rate-limited or invalid
    if (json["Information"] || json["Note"]) return null;

    const feed = json["feed"] as Array<Record<string, unknown>> | undefined;
    if (!feed || feed.length === 0) return null;

    const overallSentimentLabel =
      json["overall_sentiment_label"] != null
        ? String(json["overall_sentiment_label"])
        : null;
    const overallSentimentScore =
      json["overall_sentiment_score"] != null
        ? Number(json["overall_sentiment_score"])
        : null;

    const headlines: AlphaVantageData["headlines"] = [];
    for (const article of feed.slice(0, 4)) {
      const tickerSentiments = article["ticker_sentiment"] as
        | Array<Record<string, unknown>>
        | undefined;
      const match = tickerSentiments?.find(
        (ts) => String(ts["ticker"]).toUpperCase() === ticker.toUpperCase()
      );
      headlines.push({
        title: article["title"] != null ? String(article["title"]) : "",
        source: article["source"] != null ? String(article["source"]) : "",
        url: article["url"] != null ? String(article["url"]) : "",
        sentimentLabel:
          match?.["ticker_sentiment_label"] != null
            ? String(match["ticker_sentiment_label"])
            : (article["overall_sentiment_label"] != null
                ? String(article["overall_sentiment_label"])
                : ""),
        sentimentScore:
          match?.["ticker_sentiment_score"] != null
            ? Number(match["ticker_sentiment_score"])
            : (article["overall_sentiment_score"] != null
                ? Number(article["overall_sentiment_score"])
                : 0),
        relevanceScore:
          match?.["relevance_score"] != null ? Number(match["relevance_score"]) : 0,
      });
    }

    return { overallSentimentLabel, overallSentimentScore, headlines };
  } catch {
    return null;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function enrichHoldings<
  T extends { ticker: string | null; securityName: string }
>(holdings: T[]): Promise<EnrichedHolding<T>[]> {
  const withTickers = holdings.filter(
    (h): h is T & { ticker: string } => Boolean(h.ticker)
  );

  const settled = await Promise.allSettled(
    withTickers.map(async (h) => {
      const [marketData, alternatives, fmpData, finnhubData, alphaVantageData] =
        await Promise.all([
          fetchMarketData(h.ticker),
          fetchAlternatives(h.ticker),
          fetchFmpData(h.ticker),
          fetchFinnhubData(h.ticker),
          fetchAlphaVantageData(h.ticker),
        ]);
      return { ticker: h.ticker, marketData, alternatives, fmpData, finnhubData, alphaVantageData };
    })
  );

  const enrichmentMap = new Map<
    string,
    {
      marketData: MarketData | null;
      alternatives: Alternative[];
      fmpData: FmpData | null;
      finnhubData: FinnhubData | null;
      alphaVantageData: AlphaVantageData | null;
    }
  >();
  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      enrichmentMap.set(outcome.value.ticker, {
        marketData: outcome.value.marketData,
        alternatives: outcome.value.alternatives,
        fmpData: outcome.value.fmpData,
        finnhubData: outcome.value.finnhubData,
        alphaVantageData: outcome.value.alphaVantageData,
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
      fmpData: enrichment?.fmpData ?? null,
      finnhubData: enrichment?.finnhubData ?? null,
      alphaVantageData: enrichment?.alphaVantageData ?? null,
    };
  });
}
