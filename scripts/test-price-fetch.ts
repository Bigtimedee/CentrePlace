import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import yahooFinance from "yahoo-finance2";

async function main() {
  console.log("Fetching NVDA price from Yahoo Finance...");
  try {
    const quote = await yahooFinance.quote("NVDA") as unknown as { regularMarketPrice?: number; symbol?: string };
    console.log("symbol:", quote.symbol);
    console.log("regularMarketPrice:", quote.regularMarketPrice);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
