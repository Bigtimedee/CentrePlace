import { pgTable, text, real, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
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
  shares: real("shares"),
  pricePerShare: real("price_per_share"),
  marketValue: real("market_value").notNull(),
  percentOfAccount: real("percent_of_account"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("account_holdings_statement_id_idx").on(t.statementId),
  index("account_holdings_user_id_idx").on(t.userId),
  index("account_holdings_account_id_idx").on(t.accountId),
]);
