import { pgTable, text, real, timestamp, jsonb, index, uuid, decimal } from "drizzle-orm/pg-core";
import { userProfiles } from "./users";
import { investmentAccounts } from "./portfolios";

export const accountStatements = pgTable("account_statements", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  accountId: text("account_id").references(() => investmentAccounts.id, { onDelete: "set null" }),
  fileName: text("file_name").notNull(),
  storagePath: text("storage_path").notNull(),
  parsedAt: timestamp("parsed_at"),
  statementDate: text("statement_date"),
  brokerageName: text("brokerage_name"),
  rawParseOutput: jsonb("raw_parse_output"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("account_statements_user_id_idx").on(t.userId),
  index("account_statements_account_id_idx").on(t.accountId),
]);

export const accountHoldings = pgTable("account_holdings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  statementId: text("statement_id").notNull().references(() => accountStatements.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  accountId: text("account_id").references(() => investmentAccounts.id, { onDelete: "set null" }),
  ticker: text("ticker"),
  securityName: text("security_name").notNull(),
  assetClass: text("asset_class").notNull().default("equity"), // equity | bond | alt | cash
  securitySubType: text("security_sub_type"), // stock | etf | mutual_fund | money_market | treasury | corporate_bond | muni_bond
  shares: real("shares"),
  pricePerShare: real("price_per_share"),
  marketValue: real("market_value").notNull(),
  percentOfAccount: real("percent_of_account"),
  costBasis: decimal("cost_basis", { precision: 18, scale: 6 }),
  currentPrice: decimal("current_price", { precision: 18, scale: 6 }),
  currentValue: decimal("current_value", { precision: 18, scale: 6 }),
  priceRefreshedAt: timestamp("price_refreshed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("account_holdings_statement_id_idx").on(t.statementId),
  index("account_holdings_user_id_idx").on(t.userId),
  index("account_holdings_account_id_idx").on(t.accountId),
]);

export const holdingRecommendations = pgTable("holding_recommendations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  holdingId: text("holding_id").notNull().references(() => accountHoldings.id, { onDelete: "cascade" }),
  ticker: text("ticker"),
  securityName: text("security_name").notNull(),
  action: text("action").notNull(), // "INCREASE"|"DECREASE"|"HOLD"|"REPLACE"|"SELL"
  targetAllocationNote: text("target_allocation_note").notNull(),
  alternativeTicker: text("alternative_ticker"),
  alternativeSecurityName: text("alternative_security_name"),
  shortRationale: text("short_rationale").notNull(),
  fullRationale: text("full_rationale").notNull(),
  citations: jsonb("citations").notNull().default([]),
  urgency: text("urgency").notNull(), // "high"|"medium"|"low"
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("holding_recommendations_user_id_idx").on(t.userId),
  index("holding_recommendations_holding_id_idx").on(t.holdingId),
]);
