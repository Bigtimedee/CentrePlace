import type { ToolDefinition } from "../types";
import { fdaGet, fdaPost } from "./fda";

export const fdaToolDefinitions: ToolDefinition[] = [
  {
    name: "get_unified_financials",
    description:
      "Fetch income statement, cash flow, and balance sheet for a ticker in a single call using financialdatasets.ai. Prefer this over individual FMP calls when you need all three statements.",
    inputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "Stock ticker symbol, e.g. AAPL" },
        period: {
          type: "string",
          enum: ["annual", "quarterly", "ttm"],
          description: "Reporting period. Default: annual",
        },
        limit: { type: "number", description: "Number of periods (1–10). Default 3." },
      },
      required: ["ticker"],
    },
  },
  {
    name: "read_sec_filings",
    description:
      "Retrieve SEC filing metadata (10-K, 10-Q, 8-K) for a company. Returns filing date, form type, and filing URL.",
    inputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string" },
        form_type: {
          type: "string",
          description: "SEC form type: 10-K, 10-Q, 8-K, etc.",
        },
        limit: { type: "number", description: "Number of filings (1–20). Default 5." },
      },
      required: ["ticker"],
    },
  },
  {
    name: "screen_stocks",
    description:
      "Screen stocks by financial criteria (e.g. market cap, P/E ratio, revenue growth). Returns a list of matching tickers with key metrics.",
    inputSchema: {
      type: "object",
      properties: {
        filters: {
          type: "array",
          description:
            "Array of filter objects, each with { field, operator, value }. Operators: gt, gte, lt, lte, eq. Example: [{ field: 'market_cap', operator: 'gt', value: 10000000000 }]",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              operator: { type: "string" },
              value: { type: "number" },
            },
            required: ["field", "operator", "value"],
          },
        },
        limit: { type: "number", description: "Max results (1–50). Default 20." },
      },
      required: ["filters"],
    },
  },
  {
    name: "get_market_data",
    description:
      "Fetch market data for a ticker: current price snapshot, price history, recent news, or insider trading activity.",
    inputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string" },
        type: {
          type: "string",
          enum: ["price_snapshot", "price_history", "news", "insider_trades"],
          description: "Type of market data to retrieve.",
        },
        limit: {
          type: "number",
          description: "For price_history, news, insider_trades: number of records. Default 10.",
        },
      },
      required: ["ticker", "type"],
    },
  },
];

interface UnifiedFinancialsInput {
  ticker: string;
  period?: string;
  limit?: number;
}

interface SecFilingsInput {
  ticker: string;
  form_type?: string;
  limit?: number;
}

interface ScreenFilter {
  field: string;
  operator: string;
  value: number;
}

interface ScreenInput {
  filters: ScreenFilter[];
  limit?: number;
}

interface MarketDataInput {
  ticker: string;
  type: "price_snapshot" | "price_history" | "news" | "insider_trades";
  limit?: number;
}

export async function runFdaTool(
  toolName: string,
  input: unknown,
): Promise<string> {
  try {
    let data: unknown;

    switch (toolName) {
      case "get_unified_financials": {
        const { ticker, period = "annual", limit = 3 } =
          input as UnifiedFinancialsInput;
        const sym = ticker.toUpperCase();
        // Fetch all three statements concurrently
        const [income, cashFlow, balance] = await Promise.all([
          fdaGet("/financials/income-statements", {
            ticker: sym,
            period,
            limit,
          }),
          fdaGet("/financials/cash-flow-statements", {
            ticker: sym,
            period,
            limit,
          }),
          fdaGet("/financials/balance-sheets", {
            ticker: sym,
            period,
            limit,
          }),
        ]);
        data = { income_statements: income, cash_flow_statements: cashFlow, balance_sheets: balance };
        break;
      }

      case "read_sec_filings": {
        const { ticker, form_type, limit = 5 } = input as SecFilingsInput;
        data = await fdaGet("/sec/filings", {
          ticker: ticker.toUpperCase(),
          form_type,
          limit,
        });
        break;
      }

      case "screen_stocks": {
        const { filters, limit = 20 } = input as ScreenInput;
        data = await fdaPost("/screener/filter", { filters, limit });
        break;
      }

      case "get_market_data": {
        const { ticker, type, limit = 10 } = input as MarketDataInput;
        const sym = ticker.toUpperCase();
        switch (type) {
          case "price_snapshot":
            data = await fdaGet("/prices/snapshot", { ticker: sym });
            break;
          case "price_history":
            data = await fdaGet("/prices/history", { ticker: sym, limit });
            break;
          case "news":
            data = await fdaGet("/news", { ticker: sym, limit });
            break;
          case "insider_trades":
            data = await fdaGet("/insider-trades", { ticker: sym, limit });
            break;
          default:
            return JSON.stringify({ error: `Unknown market data type: ${type}` });
        }
        break;
      }

      default:
        return JSON.stringify({ error: `Unknown FDA tool: ${toolName}` });
    }

    return JSON.stringify(data);
  } catch (err) {
    return JSON.stringify({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
