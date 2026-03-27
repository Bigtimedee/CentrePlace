/**
 * Seed script: inserts fake brokerage statement holdings for dtmaloney@gmail.com.
 * Run with:  npx tsx --env-file=.env.local scripts/seed-dtmaloney-holdings.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/server/db/schema";
import { investmentAccounts } from "../src/server/db/schema/portfolios";
import { accountStatements, accountHoldings } from "../src/server/db/schema/holdings";

// ── DB connection ──────────────────────────────────────────────────────────────
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { prepare: false, max: 1 });
const db = drizzle(client, { schema });

// ── Clerk user lookup ──────────────────────────────────────────────────────────
const TARGET_EMAIL = "dtmaloney@gmail.com";

async function getClerkUserId(email: string): Promise<string> {
  const res = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}&limit=1`,
    {
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  if (!res.ok) throw new Error(`Clerk API error: ${res.status} ${await res.text()}`);
  const users = (await res.json()) as Array<{ id: string; email_addresses: Array<{ email_address: string }> }>;
  const match = users.find((u) =>
    u.email_addresses.some((e) => e.email_address.toLowerCase() === email.toLowerCase())
  );
  if (!match) throw new Error(`No Clerk user found for email: ${email}`);
  return match.id;
}

// ── Seed data ──────────────────────────────────────────────────────────────────

type HoldingInput = {
  ticker: string;
  securityName: string;
  assetClass: string;
  securitySubType: string;
  shares: number | null;
  pricePerShare: number | null;
  marketValue: number;
};

const TAXABLE_HOLDINGS: HoldingInput[] = [
  { ticker: "JEPI",  securityName: "JPMorgan Equity Premium Income ETF",       assetClass: "equity", securitySubType: "etf",          shares: 100,     pricePerShare: 57.40,   marketValue: 5740 },
  { ticker: "JEPQ",  securityName: "JPMorgan Nasdaq Equity Premium Income ETF", assetClass: "equity", securitySubType: "etf",          shares: 200,     pricePerShare: 52.15,   marketValue: 10430 },
  { ticker: "NVDI",  securityName: "NVDI",                                       assetClass: "equity", securitySubType: "stock",        shares: 75,      pricePerShare: 44.00,   marketValue: 3300 },
  { ticker: "XOM",   securityName: "Exxon Mobil Corporation",                   assetClass: "equity", securitySubType: "stock",        shares: 300,     pricePerShare: 113.50,  marketValue: 34050 },
  { ticker: "EQT",   securityName: "EQT Corporation",                           assetClass: "equity", securitySubType: "stock",        shares: 400,     pricePerShare: 44.80,   marketValue: 17920 },
  { ticker: "MSFT",  securityName: "Microsoft Corporation",                     assetClass: "equity", securitySubType: "stock",        shares: 125,     pricePerShare: 415.00,  marketValue: 51875 },
  { ticker: "PJLXX", securityName: "JPMorgan Prime Money Market Fund",          assetClass: "cash",   securitySubType: "money_market", shares: 5000000, pricePerShare: 1.00,    marketValue: 5000000 },
  { ticker: "INVX",  securityName: "Investors Bancorp",                         assetClass: "equity", securitySubType: "stock",        shares: 1200,    pricePerShare: 18.50,   marketValue: 22200 },
  { ticker: "BTDR",  securityName: "Bitdeer Technologies Group",                assetClass: "alt",    securitySubType: "stock",        shares: 2400,    pricePerShare: 8.20,    marketValue: 19680 },
  { ticker: "LAR",   securityName: "LAR",                                        assetClass: "equity", securitySubType: "stock",        shares: 300,     pricePerShare: 22.00,   marketValue: 6600 },
  { ticker: "DMLP",  securityName: "Dorchester Minerals LP",                    assetClass: "equity", securitySubType: "stock",        shares: 400,     pricePerShare: 25.60,   marketValue: 10240 },
  { ticker: "VNOM",  securityName: "Viper Energy Inc.",                         assetClass: "equity", securitySubType: "stock",        shares: 100,     pricePerShare: 36.90,   marketValue: 3690 },
];

const IRA_HOLDINGS: HoldingInput[] = [
  { ticker: "VOO",   securityName: "Vanguard S&P 500 ETF",          assetClass: "equity", securitySubType: "etf",   shares: 2000, pricePerShare: 512.00, marketValue: 1024000 },
  { ticker: "IBIT",  securityName: "iShares Bitcoin Trust ETF",      assetClass: "alt",    securitySubType: "etf",   shares: 400,  pricePerShare: 52.00,  marketValue: 20800 },
  { ticker: "BSM",   securityName: "Black Stone Minerals Company LP", assetClass: "equity", securitySubType: "stock", shares: 800,  pricePerShare: 16.40,  marketValue: 13120 },
  { ticker: "ASML",  securityName: "ASML Holding NV",                assetClass: "equity", securitySubType: "stock", shares: 350,  pricePerShare: 750.00, marketValue: 262500 },
];

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Looking up Clerk user for ${TARGET_EMAIL}…`);
  const userId = await getClerkUserId(TARGET_EMAIL);
  console.log(`Found user: ${userId}`);

  // ── Taxable brokerage account ──
  const taxableTotal = TAXABLE_HOLDINGS.reduce((s, h) => s + h.marketValue, 0);
  const [taxableAccount] = await db
    .insert(investmentAccounts)
    .values({
      userId,
      accountName: "Taxable Brokerage",
      accountType: "taxable",
      currentBalance: taxableTotal,
      equityPct: 0.65,
      bondPct: 0.10,
      altPct: 0.25,
      annualContribution: 0,
    })
    .returning();
  console.log(`Created taxable account: ${taxableAccount.id}  ($${taxableTotal.toLocaleString()})`);

  const [taxableStatement] = await db
    .insert(accountStatements)
    .values({
      userId,
      accountId: taxableAccount.id,
      fileName: "fake-brokerage-taxable-2025.pdf",
      storagePath: "fake/seed/taxable-2025.pdf",
      parsedAt: new Date(),
      statementDate: "2025-12-31",
      brokerageName: "Fidelity Investments",
    })
    .returning();
  console.log(`Created taxable statement: ${taxableStatement.id}`);

  await db.insert(accountHoldings).values(
    TAXABLE_HOLDINGS.map((h) => ({
      userId,
      statementId: taxableStatement.id,
      accountId: taxableAccount.id,
      ticker: h.ticker,
      securityName: h.securityName,
      assetClass: h.assetClass,
      securitySubType: h.securitySubType,
      shares: h.shares,
      pricePerShare: h.pricePerShare,
      marketValue: h.marketValue,
    }))
  );
  console.log(`Inserted ${TAXABLE_HOLDINGS.length} taxable holdings`);

  // ── Traditional IRA ──
  const iraTotal = IRA_HOLDINGS.reduce((s, h) => s + h.marketValue, 0);
  const [iraAccount] = await db
    .insert(investmentAccounts)
    .values({
      userId,
      accountName: "Traditional IRA",
      accountType: "traditional_ira",
      currentBalance: iraTotal,
      equityPct: 0.85,
      bondPct: 0.10,
      altPct: 0.05,
      annualContribution: 7000,
    })
    .returning();
  console.log(`Created IRA account: ${iraAccount.id}  ($${iraTotal.toLocaleString()})`);

  const [iraStatement] = await db
    .insert(accountStatements)
    .values({
      userId,
      accountId: iraAccount.id,
      fileName: "fake-ira-statement-2025.pdf",
      storagePath: "fake/seed/ira-2025.pdf",
      parsedAt: new Date(),
      statementDate: "2025-12-31",
      brokerageName: "Fidelity Investments",
    })
    .returning();
  console.log(`Created IRA statement: ${iraStatement.id}`);

  await db.insert(accountHoldings).values(
    IRA_HOLDINGS.map((h) => ({
      userId,
      statementId: iraStatement.id,
      accountId: iraAccount.id,
      ticker: h.ticker,
      securityName: h.securityName,
      assetClass: h.assetClass,
      securitySubType: h.securitySubType,
      shares: h.shares,
      pricePerShare: h.pricePerShare,
      marketValue: h.marketValue,
    }))
  );
  console.log(`Inserted ${IRA_HOLDINGS.length} IRA holdings`);

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
