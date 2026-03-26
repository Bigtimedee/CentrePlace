import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
import { isCryptoTicker, refreshCryptoPrices } from "./crypto-price-refresh";

export type PriceData = {
  ticker: string;
  currentPrice: number;
  currentValue: number;
};

/**
 * Fetches current prices for stock holdings via Yahoo Finance.
 * Processes in batches of 10 with 200ms delay between batches.
 * Returns a Map<holdingId, PriceData>.
 * Holdings without tickers or with fetch failures are silently skipped.
 */
async function refreshStockPrices(
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
        const quote = await yahooFinance.quote(h.ticker.toUpperCase()) as unknown as { regularMarketPrice?: number };
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

/**
 * Fetches current prices for all holdings, routing crypto tickers to CoinGecko
 * and equity tickers to Yahoo Finance. Both fetches run in parallel.
 * Returns a Map<holdingId, PriceData>.
 */
export async function refreshHoldingPrices(
  holdings: Array<{ id: string; ticker: string | null; shares: string | null }>
): Promise<Map<string, PriceData>> {
  // Split holdings into crypto and stock buckets
  const cryptoHoldings = holdings.filter(
    (h) => h.ticker != null && isCryptoTicker(h.ticker)
  );
  const stockHoldings = holdings.filter(
    (h) => h.ticker == null || !isCryptoTicker(h.ticker)
  );

  // Fetch both in parallel
  const [cryptoMap, stockMap] = await Promise.all([
    refreshCryptoPrices(cryptoHoldings),
    refreshStockPrices(stockHoldings),
  ]);

  // Merge crypto and stock results into a single map
  const result = new Map<string, PriceData>([...stockMap, ...cryptoMap]);
  return result;
}
