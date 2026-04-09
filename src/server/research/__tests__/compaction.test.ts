import { describe, it, expect, vi, beforeEach } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { shouldCompact, compactContext } from "../compaction";
import type { CompactionInput } from "../compaction";

// Mock callLlm so tests don't make real API calls
vi.mock("../llm", () => ({
  callLlm: vi.fn(),
}));

import { callLlm } from "../llm";

const mockCallLlm = vi.mocked(callLlm);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUserMsg(text: string): Anthropic.MessageParam {
  return { role: "user", content: text };
}

function makeToolResultMsg(toolId: string, text: string): Anthropic.MessageParam {
  return {
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: toolId,
        content: text,
      },
    ],
  };
}

function makeLlmResponse(text: string): Anthropic.Message {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    content: [{ type: "text", text }],
    model: "claude-test",
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  };
}

/** Build a CompactionInput with N small messages and a configurable traceLength. */
function makeInput(traceLength: number, messages?: Anthropic.MessageParam[]): CompactionInput {
  return {
    messages: messages ?? [makeUserMsg("What is AAPL's P/E ratio?")],
    systemPrompt: "You are a research assistant.",
    traceLength,
    estimatedTokens: 0,
  };
}

/** Build a large tool-result message that exceeds the token threshold on its own. */
function makeLargeInput(): CompactionInput {
  // TOKEN_THRESHOLD = 60_000; chars / 3.5 = tokens → need >210_000 chars
  const largeText = "x".repeat(220_000);
  return {
    messages: [
      makeUserMsg("query"),
      makeToolResultMsg("t1", largeText),
    ],
    systemPrompt: "You are a research assistant.",
    traceLength: 5, // >= COMPACTION_TRACE_MIN=4
    estimatedTokens: 0,
  };
}

// ---------------------------------------------------------------------------
// shouldCompact
// ---------------------------------------------------------------------------

describe("shouldCompact - below thresholds", () => {
  it("returns false when traceLength < 4 even with large messages", () => {
    const input = makeLargeInput();
    input.traceLength = 3; // below COMPACTION_TRACE_MIN=4
    expect(shouldCompact(input)).toBe(false);
  });

  it("returns false when messages are small (below token threshold)", () => {
    const input = makeInput(10, [makeUserMsg("short query")]);
    expect(shouldCompact(input)).toBe(false);
  });

  it("returns false when traceLength is exactly 3", () => {
    const input = makeLargeInput();
    input.traceLength = 3;
    expect(shouldCompact(input)).toBe(false);
  });
});

describe("shouldCompact - above thresholds", () => {
  it("returns true when traceLength >= 4 AND tokens exceed 60k", () => {
    const input = makeLargeInput(); // traceLength=5, large text
    expect(shouldCompact(input)).toBe(true);
  });

  it("returns false when traceLength is exactly 4 but messages are small", () => {
    const input = makeInput(4, [makeUserMsg("short")]);
    expect(shouldCompact(input)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// compactContext - no compaction
// ---------------------------------------------------------------------------

describe("compactContext - no trigger", () => {
  it("returns original messages reference when shouldCompact is false", async () => {
    const input = makeInput(2);
    const result = await compactContext(input);
    expect(result.compacted).toBe(false);
    expect(result.messages).toBe(input.messages);
    expect(result.summary).toBe("");
    expect(mockCallLlm).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// compactContext - with compaction triggered
// ---------------------------------------------------------------------------

describe("compactContext - triggered", () => {
  it("calls callLlm when thresholds are exceeded", async () => {
    const input = makeLargeInput();
    mockCallLlm.mockResolvedValue(
      makeLlmResponse("<summary>Research on AAPL P/E ratio: 28x trailing, 25x forward.</summary>"),
    );

    await compactContext(input);
    expect(mockCallLlm).toHaveBeenCalledTimes(1);
  });

  it("returns compacted=true with a single continuation message", async () => {
    const input = makeLargeInput();
    mockCallLlm.mockResolvedValue(
      makeLlmResponse("<summary>AAPL: P/E 28x, revenue $394B.</summary>"),
    );

    const result = await compactContext(input);
    expect(result.compacted).toBe(true);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("user");
  });

  it("extracts summary from <summary> tags", async () => {
    const input = makeLargeInput();
    const summaryText = "AAPL: P/E 28x, revenue $394B.";
    mockCallLlm.mockResolvedValue(
      makeLlmResponse(`<summary>${summaryText}</summary>`),
    );

    const result = await compactContext(input);
    expect(result.summary).toBe(summaryText);
  });

  it("includes the summary in the continuation message content", async () => {
    const input = makeLargeInput();
    const summaryText = "MSFT: cloud revenue $87B, PE 33x.";
    mockCallLlm.mockResolvedValue(
      makeLlmResponse(`<summary>${summaryText}</summary>`),
    );

    const result = await compactContext(input);
    const content = result.messages[0].content as string;
    expect(content).toContain(summaryText);
    expect(content).toContain("Context compacted");
  });

  it("returns compacted=false when LLM returns no summary tags and no text", async () => {
    const input = makeLargeInput();
    // Response has no text blocks at all
    mockCallLlm.mockResolvedValue({
      ...makeLlmResponse(""),
      content: [],
    });

    const result = await compactContext(input);
    expect(result.compacted).toBe(false);
    expect(result.messages).toBe(input.messages);
  });

  it("uses full text as summary fallback when no <summary> tags present", async () => {
    const input = makeLargeInput();
    mockCallLlm.mockResolvedValue(makeLlmResponse("Plain summary without tags."));

    const result = await compactContext(input);
    // extractSummary falls back to full text when no tags
    expect(result.summary).toBe("Plain summary without tags.");
    expect(result.compacted).toBe(true);
  });

  it("passes the system prompt through to callLlm", async () => {
    const input = makeLargeInput();
    input.systemPrompt = "Custom system prompt";
    mockCallLlm.mockResolvedValue(
      makeLlmResponse("<summary>summary</summary>"),
    );

    await compactContext(input);
    expect(mockCallLlm).toHaveBeenCalledWith(
      expect.any(Array),
      "Custom system prompt",
      [],
    );
  });

  it("does not mutate the original messages array", async () => {
    const input = makeLargeInput();
    const originalLength = input.messages.length;
    mockCallLlm.mockResolvedValue(
      makeLlmResponse("<summary>summary</summary>"),
    );

    await compactContext(input);
    expect(input.messages).toHaveLength(originalLength);
  });
});
