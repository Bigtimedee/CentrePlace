import { pgTable, text, real, integer, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { userProfiles } from "./users";

export const cryptoHoldings = pgTable(
  "crypto_holdings",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
    coinName: text("coin_name").notNull(),
    symbol: text("symbol"),
    quantityCoins: real("quantity_coins").notNull().default(0),
    pricePerCoin: real("price_per_coin"),
    currentValue: real("current_value").notNull(),
    costBasis: real("cost_basis"),
    expectedAppreciationRate: real("expected_appreciation_rate").notNull().default(0.07),
    expectedSaleYear: integer("expected_sale_year"),
    saleFraction: real("sale_fraction"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().default(sql`now()`),
    updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  },
  (t) => [
    index("crypto_holdings_user_id_idx").on(t.userId),
  ]
);
