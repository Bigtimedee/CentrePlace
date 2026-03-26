/**
 * Maps common crypto ticker symbols to CoinGecko coin IDs.
 * Extend this map as needed.
 */
export const TICKER_TO_COINGECKO_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  DOT: "polkadot",
  LINK: "chainlink",
  UNI: "uniswap",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  ATOM: "cosmos",
  XLM: "stellar",
  ALGO: "algorand",
  VET: "vechain",
  FIL: "filecoin",
  TRX: "tron",
  NEAR: "near",
  SHIB: "shiba-inu",
  APT: "aptos",
  OP: "optimism",
  ARB: "arbitrum",
  SUI: "sui",
  IMX: "immutable-x",
  PEPE: "pepe",
  BONK: "bonk",
  WIF: "dogwifcoin",
};

export type CryptoPriceData = {
  ticker: string;
  currentPrice: number;
  currentValue: number;
};

/**
 * Returns true if the ticker is a known crypto asset.
 */
export function isCryptoTicker(ticker: string): boolean {
  return ticker.toUpperCase() in TICKER_TO_COINGECKO_ID;
}

/**
 * Fetches current USD prices for a batch of crypto holdings via CoinGecko's
 * free simple/price endpoint. Returns a Map<holdingId, CryptoPriceData>.
 * Holdings with unrecognized tickers are silently skipped.
 *
 * Uses CoinGecko free API: https://api.coingecko.com/api/v3/simple/price
 * No API key required for the free tier.
 */
export async function refreshCryptoPrices(
  holdings: Array<{ id: string; ticker: string | null; shares: string | null }>
): Promise<Map<string, CryptoPriceData>> {
  const result = new Map<string, CryptoPriceData>();

  // Filter to only known crypto tickers
  const cryptoHoldings = holdings.filter(
    (h): h is typeof h & { ticker: string } =>
      Boolean(h.ticker) && isCryptoTicker(h.ticker!)
  );

  if (cryptoHoldings.length === 0) return result;

  // Build a deduplicated list of coin IDs to fetch
  const coinIdSet = new Set<string>();
  for (const h of cryptoHoldings) {
    const coinId = TICKER_TO_COINGECKO_ID[h.ticker.toUpperCase()];
    if (coinId) coinIdSet.add(coinId);
  }
  const coinIds = Array.from(coinIdSet).join(",");

  // Fetch prices from CoinGecko
  let priceData: Record<string, { usd: number }> = {};
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd`;
    const response = await fetch(url, {
      headers: { "User-Agent": "CentrePlace/1.0" },
    });
    if (!response.ok) return result;
    priceData = (await response.json()) as Record<string, { usd: number }>;
  } catch {
    // CoinGecko is unreachable — return empty map rather than throwing
    return result;
  }

  // Build the result map
  for (const h of cryptoHoldings) {
    const coinId = TICKER_TO_COINGECKO_ID[h.ticker.toUpperCase()];
    if (!coinId) continue;

    const entry = priceData[coinId];
    if (!entry?.usd) continue;

    const price = entry.usd;
    const sharesNum = parseFloat(h.shares ?? "0");
    const value = !isNaN(sharesNum) ? price * sharesNum : 0;

    result.set(h.id, {
      ticker: h.ticker.toUpperCase(),
      currentPrice: price,
      currentValue: value,
    });
  }

  return result;
}
