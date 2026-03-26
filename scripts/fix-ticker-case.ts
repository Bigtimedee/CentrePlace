/**
 * One-off migration: uppercases all ticker values in account_holdings.
 * Run with: npx tsx scripts/fix-ticker-case.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client);

  // Show affected rows before update
  const before = await db.execute(
    sql`SELECT id, ticker FROM account_holdings WHERE ticker IS NOT NULL AND ticker != UPPER(ticker)`
  );
  console.log("Mixed-case tickers found:", before);

  if (before.length > 0) {
    await db.execute(
      sql`UPDATE account_holdings SET ticker = UPPER(ticker) WHERE ticker IS NOT NULL AND ticker != UPPER(ticker)`
    );
    console.log(`Fixed ${before.length} ticker(s).`);
  } else {
    console.log("No mixed-case tickers found.");
  }

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
