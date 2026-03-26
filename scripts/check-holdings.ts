import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client);

  const rows = await db.execute(
    sql`SELECT id, ticker, security_name, shares, price_per_share, market_value, current_price, current_value FROM account_holdings WHERE ticker ILIKE 'nvda' ORDER BY created_at DESC`
  );
  console.log("NVDA holdings:", JSON.stringify(rows, null, 2));
  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
