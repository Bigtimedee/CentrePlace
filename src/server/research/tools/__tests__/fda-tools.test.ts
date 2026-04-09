import { describe, it, expect, vi, beforeEach } from "vitest";
import { runFdaTool, fdaToolDefinitions } from "../fda-tools";

// Mock the fda module so we don't make real HTTP calls
vi.mock("../fda", () => ({
  fdaGet: vi.fn(),
  fdaPost: vi.fn(),
}));

import { fdaGet, fdaPost } from "../fda";

const mockGet = vi.mocked(fdaGet);
const mockPost = vi.mocked(fdaPost);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fdaToolDefinitions", () => {
  it("exports 4 tool definitions", () => {
    expect(fdaToolDefinitions).toHaveLength(4);
  });

  it("includes get_unified_financials", () => {
    expect(fdaToolDefinitions.find((t) => t.name === "get_unified_financials")).toBeDefined();
  });

  it("includes read_sec_filings", () => {
    expect(fdaToolDefinitions.find((t) => t.name === "read_sec_filings")).toBeDefined();
  });

  it("includes screen_stocks", () => {
    expect(fdaToolDefinitions.find((t) => t.name === "screen_stocks")).toBeDefined();
  });

  it("includes get_market_data", () => {
    expect(fdaToolDefinitions.find((t) => t.name === "get_market_data")).toBeDefined();
  });
});

describe("runFdaTool - get_unified_financials", () => {
  it("calls all three financial endpoints concurrently", async () => {
    mockGet.mockResolvedValue({ data: [] });

    const result = await runFdaTool("get_unified_financials", { ticker: "aapl" });
    const parsed = JSON.parse(result);

    expect(parsed).toHaveProperty("income_statements");
    expect(parsed).toHaveProperty("cash_flow_statements");
    expect(parsed).toHaveProperty("balance_sheets");
    expect(mockGet).toHaveBeenCalledTimes(3);
  });

  it("uppercases the ticker", async () => {
    mockGet.mockResolvedValue({});

    await runFdaTool("get_unified_financials", { ticker: "msft" });

    for (const call of mockGet.mock.calls) {
      expect(call[1]).toMatchObject({ ticker: "MSFT" });
    }
  });

  it("defaults period to annual and limit to 3", async () => {
    mockGet.mockResolvedValue({});

    await runFdaTool("get_unified_financials", { ticker: "TSLA" });

    for (const call of mockGet.mock.calls) {
      expect(call[1]).toMatchObject({ period: "annual", limit: 3 });
    }
  });
});

describe("runFdaTool - read_sec_filings", () => {
  it("calls /sec/filings with correct params", async () => {
    mockGet.mockResolvedValue([]);

    const result = await runFdaTool("read_sec_filings", {
      ticker: "nvda",
      form_type: "10-K",
      limit: 2,
    });

    expect(mockGet).toHaveBeenCalledWith("/sec/filings", {
      ticker: "NVDA",
      form_type: "10-K",
      limit: 2,
    });
    expect(JSON.parse(result)).toEqual([]);
  });
});

describe("runFdaTool - screen_stocks", () => {
  it("calls fdaPost with filters", async () => {
    mockPost.mockResolvedValue({ tickers: ["AAPL"] });

    const filters = [{ field: "market_cap", operator: "gt", value: 1e12 }];
    const result = await runFdaTool("screen_stocks", { filters, limit: 5 });

    expect(mockPost).toHaveBeenCalledWith("/screener/filter", { filters, limit: 5 });
    expect(JSON.parse(result)).toEqual({ tickers: ["AAPL"] });
  });
});

describe("runFdaTool - get_market_data", () => {
  it("routes price_snapshot to /prices/snapshot", async () => {
    mockGet.mockResolvedValue({ price: 150 });

    await runFdaTool("get_market_data", { ticker: "goog", type: "price_snapshot" });

    expect(mockGet).toHaveBeenCalledWith("/prices/snapshot", { ticker: "GOOG" });
  });

  it("routes price_history with limit", async () => {
    mockGet.mockResolvedValue([]);

    await runFdaTool("get_market_data", { ticker: "AMZN", type: "price_history", limit: 30 });

    expect(mockGet).toHaveBeenCalledWith("/prices/history", { ticker: "AMZN", limit: 30 });
  });

  it("routes news", async () => {
    mockGet.mockResolvedValue([]);

    await runFdaTool("get_market_data", { ticker: "META", type: "news" });

    expect(mockGet).toHaveBeenCalledWith("/news", { ticker: "META", limit: 10 });
  });

  it("routes insider_trades", async () => {
    mockGet.mockResolvedValue([]);

    await runFdaTool("get_market_data", { ticker: "NFLX", type: "insider_trades" });

    expect(mockGet).toHaveBeenCalledWith("/insider-trades", { ticker: "NFLX", limit: 10 });
  });

  it("returns error for unknown type", async () => {
    const result = await runFdaTool("get_market_data", {
      ticker: "X",
      type: "unknown_type",
    });
    expect(JSON.parse(result)).toHaveProperty("error");
  });
});

describe("runFdaTool - unknown tool", () => {
  it("returns error for unknown tool name", async () => {
    const result = await runFdaTool("nonexistent_tool", {});
    expect(JSON.parse(result)).toHaveProperty("error");
    expect(JSON.parse(result).error).toContain("Unknown FDA tool");
  });
});

describe("runFdaTool - error handling", () => {
  it("returns error JSON when fdaGet throws", async () => {
    mockGet.mockRejectedValue(new Error("Network error"));

    const result = await runFdaTool("read_sec_filings", { ticker: "ERR" });
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("error");
    expect(parsed.error).toContain("Network error");
  });
});
