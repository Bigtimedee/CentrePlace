import type { ToolDefinition } from "../types";
import type { DB } from "@/server/db/index";
import { accountHoldings, investmentAccounts } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export const portfolioToolDefinitions: ToolDefinition[] = [
  {
    name: "get_user_holdings",
    description:
      "Retrieve the authenticated user's current investment holdings across all accounts. Returns ticker, security name, asset class, market value, and account type.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_user_accounts",
    description:
      "Retrieve a summary of the user's investment accounts — account name, type (taxable/IRA/401k), and current balance.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

export async function runPortfolioTool(
  toolName: string,
  _input: unknown,
  db: DB,
  userId: string,
): Promise<string> {
  try {
    if (toolName === "get_user_holdings") {
      const holdings = await db
        .select({
          ticker: accountHoldings.ticker,
          securityName: accountHoldings.securityName,
          assetClass: accountHoldings.assetClass,
          marketValue: accountHoldings.marketValue,
          shares: accountHoldings.shares,
          pricePerShare: accountHoldings.pricePerShare,
        })
        .from(accountHoldings)
        .where(
          and(
            eq(accountHoldings.userId, userId),
          ),
        );
      return JSON.stringify(holdings);
    }

    if (toolName === "get_user_accounts") {
      const accounts = await db
        .select({
          accountName: investmentAccounts.accountName,
          accountType: investmentAccounts.accountType,
          currentBalance: investmentAccounts.currentBalance,
        })
        .from(investmentAccounts)
        .where(eq(investmentAccounts.userId, userId));
      return JSON.stringify(accounts);
    }

    return JSON.stringify({ error: `Unknown portfolio tool: ${toolName}` });
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
  }
}
