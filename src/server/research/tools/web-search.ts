import type { ToolDefinition } from "../types";

export const webToolDefinitions: ToolDefinition[] = [
  {
    name: "web_search",
    description:
      "Search the web for current financial news, market data, or company information not available via financial data APIs.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query string" },
        numResults: {
          type: "number",
          description: "Number of results to return (1–10). Default 5.",
        },
      },
      required: ["query"],
    },
  },
];

interface SearchInput {
  query: string;
  numResults?: number;
}

interface EXAResult {
  title: string;
  url: string;
  publishedDate?: string;
  text?: string;
  snippet?: string;
}

interface TavilyResult {
  title: string;
  url: string;
  published_date?: string;
  content?: string;
}

async function searchWithExa(query: string, numResults: number): Promise<string> {
  const key = process.env.EXASEARCH_API_KEY;
  if (!key) throw new Error("no_key");

  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    body: JSON.stringify({
      query,
      numResults,
      type: "neural",
      contents: { text: { maxCharacters: 400 } },
    }),
  });
  if (!res.ok) throw new Error(`Exa ${res.status}`);
  const data = (await res.json()) as { results?: EXAResult[] };
  return JSON.stringify(
    (data.results ?? []).map((r: EXAResult) => ({
      title: r.title,
      url: r.url,
      date: r.publishedDate,
      snippet: r.text ?? r.snippet ?? "",
    })),
  );
}

async function searchWithTavily(query: string, numResults: number): Promise<string> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("no_key");

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      max_results: numResults,
      include_answer: false,
    }),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const data = (await res.json()) as { results?: TavilyResult[] };
  return JSON.stringify(
    (data.results ?? []).map((r: TavilyResult) => ({
      title: r.title,
      url: r.url,
      date: r.published_date,
      snippet: r.content ?? "",
    })),
  );
}

export async function runWebSearchTool(input: unknown): Promise<string> {
  const { query, numResults = 5 } = input as SearchInput;
  const n = Math.min(numResults, 10);

  // Try Exa first, then Tavily, then a graceful fallback message
  for (const fn of [searchWithExa, searchWithTavily]) {
    try {
      return await fn(query, n);
    } catch (err) {
      if ((err as Error).message === "no_key") continue;
      return JSON.stringify({ error: (err as Error).message });
    }
  }

  return JSON.stringify({
    error:
      "Web search unavailable. Set EXASEARCH_API_KEY or TAVILY_API_KEY to enable it.",
  });
}
