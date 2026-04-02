import type { ToolDefinition } from "../types";

const FMP_BASE = "https://financialmodelingprep.com/api/v3";

async function fmpFetch(path: string): Promise<unknown> {
  const key = process.env.FMP_API_KEY;
  if (!key) throw new Error("FMP_API_KEY not configured");
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${FMP_BASE}${path}${sep}apikey=${key}`);
  if (!res.ok) throw new Error(`FMP error ${res.status}: ${path}`);
  return res.json();
}

export const financialToolDefinitions: ToolDefinition[] = [
  {
    name: "get_income_statement",
    description:
      "Fetch annual income statements for a ticker (revenue, gross profit, net income, EPS). Limit defaults to 3 years.",
    inputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "Stock ticker symbol, e.g. AAPL" },
        limit: { type: "number", description: "Number of years (1–10). Default 3." },
      },
      required: ["ticker"],
    },
  },
  {
    name: "get_cash_flow",
    description:
      "Fetch annual cash flow statements (operating CF, capex, free cash flow).",
    inputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string" },
        limit: { type: "number", description: "Number of years (1–10). Default 3." },
      },
      required: ["ticker"],
    },
  },
  {
    name: "get_balance_sheet",
    description:
      "Fetch annual balance sheet (total assets, debt, equity, cash).",
    inputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string" },
        limit: { type: "number", description: "Number of years (1–10). Default 3." },
      },
      required: ["ticker"],
    },
  },
  {
    name: "get_key_metrics",
    description:
      "Fetch key financial ratios (P/E, P/B, EV/EBITDA, ROE, debt/equity, dividend yield).",
    inputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string" },
        limit: { type: "number", description: "Number of years (1–5). Default 3." },
      },
      required: ["ticker"],
    },
  },
  {
    name: "get_stock_quote",
    description: "Fetch current stock price, market cap, 52-week range, volume.",
    inputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string" },
      },
      required: ["ticker"],
    },
  },
  {
    name: "get_analyst_estimates",
    description:
      "Fetch Wall Street analyst price targets and buy/hold/sell ratings consensus.",
    inputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string" },
      },
      required: ["ticker"],
    },
  },
  {
    name: "get_company_news",
    description: "Fetch recent news headlines for a company ticker.",
    inputSchema: {
      type: "object",
      properties: {
        ticker: { type: "string" },
        limit: { type: "number", description: "Number of articles (1–20). Default 5." },
      },
      required: ["ticker"],
    },
  },
];

interface FinancialsInput {
  ticker: string;
  limit?: number;
}

export async function runFinancialTool(
  toolName: string,
  input: unknown,
): Promise<string> {
  const { ticker, limit = 3 } = input as FinancialsInput;
  const sym = ticker.toUpperCase();

  try {
    let data: unknown;
    switch (toolName) {
      case "get_income_statement":
        data = await fmpFetch(`/income-statement/${sym}?limit=${limit}`);
        break;
      case "get_cash_flow":
        data = await fmpFetch(`/cash-flow-statement/${sym}?limit=${limit}`);
        break;
      case "get_balance_sheet":
        data = await fmpFetch(`/balance-sheet-statement/${sym}?limit=${limit}`);
        break;
      case "get_key_metrics":
        data = await fmpFetch(`/key-metrics/${sym}?limit=${limit}`);
        break;
      case "get_stock_quote":
        data = await fmpFetch(`/quote/${sym}`);
        break;
      case "get_analyst_estimates":
        data = await fmpFetch(`/analyst-stock-recommendations/${sym}`);
        break;
      case "get_company_news": {
        const l = Math.min((input as FinancialsInput).limit ?? 5, 20);
        data = await fmpFetch(`/stock_news?tickers=${sym}&limit=${l}`);
        break;
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
    return JSON.stringify(data);
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
  }
}
