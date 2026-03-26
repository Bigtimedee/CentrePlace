import yahooFinance from "yahoo-finance2";

export type PriceData = {
  ticker: string;
  currentPrice: number;
  currentValue: number;
};

/**
 * Fetches current prices for holdings with tickers.
 * Processes in batches of 10 with 200ms delay between batches.
 * Returns a Map<holdingId, PriceData>.
 * Holdings without tickers or with fetch failures are silently skipped.
 */
export async function refreshHoldingPrices(
  holdings: Array<{ id: string; ticker: string | null; shares: string | null }>
): Promise<Map<string, PriceData>> {
  const withTickers = holdings.filter(
    (h): h is typeof h & { ticker: string } => Boolean(h.ticker)
  );

  const result = new Map<string, PriceData>();
  const BATCH_SIZE = 10;

  for (let i = 0; i < withTickers.length; i += BATCH_SIZE) {
    const batch = withTickers.slice(i, i + BATCH_SIZE);

    const settled = await Promise.allSettled(
      batch.map(async (h) => {
        const quote = await yahooFinance.quote(h.ticker, {
          fields: ["regularMarketPrice"],
        });
        const price = quote.regularMarketPrice;
        if (price == null) return null;

        const sharesNum = h.shares != null ? parseFloat(h.shares) : null;
        const value = sharesNum != null && !isNaN(sharesNum) ? price * sharesNum : 0;

        return { holdingId: h.id, ticker: h.ticker, currentPrice: price, currentValue: value };
      })
    );

    for (const outcome of settled) {
      if (outcome.status === "fulfilled" && outcome.value != null) {
        const { holdingId, ...priceData } = outcome.value;
        result.set(holdingId, priceData);
      }
      // silently skip rejections and nulls
    }

    if (i + BATCH_SIZE < withTickers.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return result;
}
