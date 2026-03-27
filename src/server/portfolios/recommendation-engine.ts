import Anthropic from "@anthropic-ai/sdk";
import { enrichHoldings } from "./data-enrichment";

export type Citation = {
  bookTitle: string;
  author: string;
  principle: string;
  relevantExcerpt: string;
  sourceUrl?: string;
};

export type HoldingRecommendation = {
  holdingId: string;
  ticker: string | null;
  securityName: string;
  action: "INCREASE" | "DECREASE" | "HOLD" | "REPLACE" | "SELL";
  targetAllocationNote: string;
  alternativeTicker?: string;
  alternativeSecurityName?: string;
  shortRationale: string;
  fullRationale: string;
  citations: Citation[];
  urgency: "high" | "medium" | "low";
};

const SYSTEM_PROMPT = `You are a portfolio construction analyst. Analyze the provided holdings and generate actionable, evidence-based recommendations grounded in academic portfolio theory AND live market data from multiple financial data sources.

Each holding object may include these live data fields — use every non-null value you find:

YAHOO FINANCE (marketData field):
- expenseRatio / netExpenseRatio: annual fund cost as a decimal (0.0003 = 0.03%)
- category, fundFamily: Morningstar fund classification
- ytdReturn, oneYearReturn, threeYearReturn, fiveYearReturn: total return as decimals
- morningStarRating: 1–5 star rating
- analystBuy, analystHold, analystSell: Yahoo Finance analyst consensus counts
- topHoldings: array of { symbol, name, percent } showing top 5 positions

YAHOO FINANCE ALTERNATIVES (alternatives array):
- Same fields as marketData for each similar/competing security
- similarityScore: how closely the alternative matches (higher = more similar)

FINANCIAL MODELING PREP — Wall Street analyst consensus (fmpData field):
- peRatio, priceToBook, dividendYieldPct, returnOnEquity, debtToEquity: key fundamentals
- analystStrongBuy, analystBuy, analystHold, analystSell, analystStrongSell: analyst distribution from institutional coverage
- priceTargetConsensus, priceTargetHigh, priceTargetLow: Wall Street 12-month price targets

FINNHUB — news sentiment (finnhubData field):
- bullishPercent, bearishPercent: % of recent financial media coverage that is bullish/bearish
- newsScore: overall news sentiment score (0–1, higher is more positive)
- recentHeadlines: up to 4 recent news items { headline, source, url }

ALPHA VANTAGE — financial news sentiment (alphaVantageData field):
- overallSentimentLabel: "Bullish", "Somewhat-Bullish", "Neutral", "Somewhat-Bearish", "Bearish"
- overallSentimentScore: sentiment score for this ticker specifically
- headlines: up to 4 articles { title, source, url, sentimentLabel, sentimentScore, relevanceScore }

INSTRUCTIONS FOR USING LIVE DATA:
1. Embed real numbers whenever available. Example: "FXAIX charges a 0.015% expense ratio vs VFIAX at 0.04%" or "SPY's P/E ratio of 23.4 exceeds its 5-year average, suggesting stretched valuations."
2. Directly compare the holding against its alternatives using actual numbers from both sides. Name the tickers explicitly.
3. When FMP shows a lopsided analyst distribution (e.g., 18 Strong Buy vs 1 Hold), factor that into urgency and action.
4. When Finnhub or Alpha Vantage sentiment is strongly bearish, raise urgency accordingly and reference it in fullRationale.
5. Cite news headlines by referencing the source name — do NOT fabricate headlines.
6. If all data fields for a holding are null, fall back to academic reasoning only.
7. Source citation rules:
   - Yahoo Finance data → sourceUrl: "https://finance.yahoo.com", author: "Yahoo Finance"
   - FMP data → sourceUrl: "https://financialmodelingprep.com", author: "Financial Modeling Prep"
   - Finnhub data → sourceUrl: "https://finnhub.io", author: "Finnhub"
   - Alpha Vantage data → sourceUrl: "https://www.alphavantage.co", author: "Alpha Vantage"

You have access to these 10 portfolio construction principles as citation sources. Each principle includes a sourceUrl you MUST copy exactly into every citation that references it:

PRINCIPLE 1 — Broad Diversification
Book: "The Intelligent Asset Allocator" by William Bernstein
sourceUrl: https://www.amazon.com/dp/0071399577
Principle: Diversify broadly across uncorrelated asset classes to reduce unsystematic risk without sacrificing expected return.

PRINCIPLE 2 — Low-Cost Indexing
Book: "All About Asset Allocation" by Richard Ferri
sourceUrl: https://www.amazon.com/dp/0071700641
Principle: Prefer low-expense-ratio index funds; every basis point in fees permanently reduces compounding.

PRINCIPLE 3 — Institutional Asset Allocation
Book: "Unconventional Success" by David Swensen
sourceUrl: https://www.amazon.com/dp/0743228383
Principle: A six-asset-class framework (domestic equity, foreign developed, emerging markets, real estate, nominal bonds, inflation-protected bonds) captures most of the return premia available to individual investors.

PRINCIPLE 4 — Factor Exposure
Book: "Portfolio Construction for Today's Markets" by Russ Koesterich
sourceUrl: https://www.amazon.com/dp/0749481943
Principle: Tilt toward documented return factors — value, size, momentum, quality — rather than relying on market-cap weighting alone.

PRINCIPLE 5 — Risk Premia Harvesting
Book: "Expected Returns" by Antti Ilmanen
sourceUrl: https://www.amazon.com/dp/0470770511
Principle: Identify and systematically harvest multiple uncorrelated risk premia; diversification of premia sources is as important as diversification of asset classes.

PRINCIPLE 6 — Asset-Liability Matching
Book: "Asset Management" by Andrew Ang
sourceUrl: https://www.amazon.com/dp/0199959323
Principle: Align portfolio duration and cash-flow profile with the investor's actual liability structure (spending needs, time horizon).

PRINCIPLE 7 — Active vs Passive Evidence
Book: "Active Portfolio Management" by Grinold & Kahn
sourceUrl: https://www.amazon.com/dp/0070248826
Principle: Active strategies must clear the Fundamental Law of Active Management — high IC × broad breadth — to justify their costs; most retail holdings fail this bar.

PRINCIPLE 8 — Behavioral Discipline
Book: "Successful Investing Is a Process" by Jacques Lussier
sourceUrl: https://www.amazon.com/dp/1118516850
Principle: Process beats prediction; systematic rebalancing rules outperform discretionary market-timing.

PRINCIPLE 9 — Position Sizing
Book: "Systematic Trading" by Robert Carver
sourceUrl: https://www.amazon.com/dp/0857194453
Principle: Size positions in proportion to their forecast Sharpe ratio and inverse of their correlation with existing holdings; avoid concentration in any single name.

PRINCIPLE 10 — Drawdown Management
Book: "Managing Downside Risk in Financial Markets" by Sortino & Satchell
sourceUrl: https://www.amazon.com/dp/0750648635
Principle: Downside deviation, not standard deviation, is the correct risk metric for goal-based investors; limit positions whose contribution to downside risk exceeds their contribution to return.

For each holding, produce a recommendation with:
- action: one of "INCREASE", "DECREASE", "HOLD", "REPLACE", or "SELL"
- urgency: "high" (needs attention soon), "medium" (worth addressing), or "low" (minor optimisation)
- A short 1-2 sentence rationale (shortRationale) and a detailed paragraph (fullRationale)
- Relevant citations from the principles above (1-3 citations per recommendation) — each citation MUST include the sourceUrl from the principle
- For REPLACE action: suggest an alternative ticker and security name
- targetAllocationNote: a brief note on target allocation guidance

Respond with a valid JSON array only — no markdown fences, no commentary outside the JSON. Each element must match this shape:
{
  "holdingId": string,
  "ticker": string | null,
  "securityName": string,
  "action": "INCREASE" | "DECREASE" | "HOLD" | "REPLACE" | "SELL",
  "targetAllocationNote": string,
  "alternativeTicker": string | undefined,
  "alternativeSecurityName": string | undefined,
  "shortRationale": string,
  "fullRationale": string,
  "citations": [
    {
      "bookTitle": string,
      "author": string,
      "principle": string,
      "relevantExcerpt": string,
      "sourceUrl": string
    }
  ],
  "urgency": "high" | "medium" | "low"
}`;

const BATCH_SIZE = 8;

function buildPayload(enriched: Awaited<ReturnType<typeof enrichHoldings>>) {
  return enriched.map((h) => ({
    holdingId: h.id,
    ticker: h.ticker,
    securityName: h.securityName,
    assetClass: h.assetClass,
    shares: h.shares,
    currentPrice: h.currentPrice,
    currentValue: h.currentValue,
    expenseRatio: h.marketData?.expenseRatio ?? h.marketData?.netExpenseRatio ?? null,
    category: h.marketData?.category ?? null,
    ytdReturn: h.marketData?.ytdReturn ?? null,
    oneYearReturn: h.marketData?.oneYearReturn ?? null,
    threeYearReturn: h.marketData?.threeYearReturn ?? null,
    morningStarRating: h.marketData?.morningStarRating ?? null,
    topAlternative: h.alternatives?.[0]
      ? {
          ticker: h.alternatives[0].ticker,
          securityName: h.alternatives[0].securityName,
          expenseRatio: h.alternatives[0].expenseRatio ?? h.alternatives[0].netExpenseRatio ?? null,
          oneYearReturn: h.alternatives[0].oneYearReturn ?? null,
          morningStarRating: h.alternatives[0].morningStarRating ?? null,
        }
      : null,
    peRatio: h.fmpData?.peRatio ?? null,
    analystStrongBuy: h.fmpData?.analystStrongBuy ?? null,
    analystBuy: h.fmpData?.analystBuy ?? null,
    analystHold: h.fmpData?.analystHold ?? null,
    analystSell: h.fmpData?.analystSell ?? null,
    analystStrongSell: h.fmpData?.analystStrongSell ?? null,
    priceTargetConsensus: h.fmpData?.priceTargetConsensus ?? null,
    finnhubBullish: h.finnhubData?.bullishPercent ?? null,
    finnhubBearish: h.finnhubData?.bearishPercent ?? null,
    alphaVantageSentiment: h.alphaVantageData?.overallSentimentLabel ?? null,
  }));
}

function parseRecommendations(text: string): HoldingRecommendation[] {
  let raw = text.trim();
  if (raw.startsWith("```")) {
    raw = raw.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();
  }
  const firstBracket = raw.indexOf("[");
  const lastBracket = raw.lastIndexOf("]");
  if (firstBracket === -1 || lastBracket === -1) {
    console.error("[recommendation-engine] Unparseable response:", raw.slice(0, 500));
    throw new Error("Failed to parse recommendation engine response as JSON");
  }
  raw = raw.slice(firstBracket, lastBracket + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Failed to parse recommendation engine response as JSON");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Recommendation engine did not return a JSON array");
  }

  return parsed.map((item: unknown) => {
    const rec = item as Record<string, unknown>;
    return {
      holdingId: rec.holdingId != null ? String(rec.holdingId) : null as unknown as string,
      ticker: rec.ticker != null ? String(rec.ticker) : null,
      securityName: String(rec.securityName ?? ""),
      action: rec.action as HoldingRecommendation["action"],
      targetAllocationNote: String(rec.targetAllocationNote ?? ""),
      alternativeTicker:
        rec.alternativeTicker != null ? String(rec.alternativeTicker) : undefined,
      alternativeSecurityName:
        rec.alternativeSecurityName != null ? String(rec.alternativeSecurityName) : undefined,
      shortRationale: String(rec.shortRationale ?? ""),
      fullRationale: String(rec.fullRationale ?? ""),
      citations: Array.isArray(rec.citations)
        ? (rec.citations as Array<Record<string, unknown>>).map((c) => ({
            bookTitle: String(c.bookTitle ?? ""),
            author: String(c.author ?? ""),
            principle: String(c.principle ?? ""),
            relevantExcerpt: String(c.relevantExcerpt ?? ""),
            sourceUrl: c.sourceUrl != null ? String(c.sourceUrl) : undefined,
          }))
        : [],
      urgency: rec.urgency as HoldingRecommendation["urgency"],
    };
  });
}

export async function generateHoldingRecommendations(
  holdings: Array<{
    id: string;
    ticker: string | null;
    securityName: string;
    assetClass: string | null;
    accountType: string | null;
    shares: string | null;
    currentPrice: string | null;
    currentValue: string | null;
  }>
): Promise<HoldingRecommendation[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }
  const client = new Anthropic({ apiKey });

  // Enrich all holdings in parallel (each races against a 4s timer internally)
  const enriched = await enrichHoldings(holdings);

  // Split into batches of BATCH_SIZE and call Claude in parallel — each batch
  // stays small enough to be fast; parallel execution keeps total time flat.
  const batches: (typeof enriched)[] = [];
  for (let i = 0; i < enriched.length; i += BATCH_SIZE) {
    batches.push(enriched.slice(i, i + BATCH_SIZE));
  }

  const batchResults = await Promise.all(
    batches.map(async (batch) => {
      const holdingsPayload = buildPayload(batch);

      const response = await Promise.race([
        client.messages.create(
          {
            model: "claude-sonnet-4-6",
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            messages: [
              {
                role: "user",
                content: `Please analyze these holdings and return a JSON array of recommendations:\n\n${JSON.stringify(holdingsPayload, null, 2)}`,
              },
            ],
          },
          { timeout: 35_000 }
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("AI response timed out. Please try again.")), 35_000)
        ),
      ]);

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text response from recommendation engine");
      }
      if (response.stop_reason === "max_tokens") {
        throw new Error("Recommendation engine response was truncated (max_tokens reached)");
      }

      return parseRecommendations(textBlock.text);
    })
  );

  return batchResults.flat();
}
