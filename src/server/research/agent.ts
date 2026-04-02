import Anthropic from "@anthropic-ai/sdk";
import { callLlm } from "./llm";
import { buildSystemPrompt, DCF_SKILL, TAX_EFFICIENCY_SKILL, FI_ANALYSIS_SKILL } from "./skills";
import { financialToolDefinitions, runFinancialTool } from "./tools/financials";
import { webToolDefinitions, runWebSearchTool } from "./tools/web-search";
import { portfolioToolDefinitions, runPortfolioTool } from "./tools/portfolio";
import type { TraceEntry, ResearchResult } from "./types";
import type { DB } from "@/server/db/index";
import { researchTraces } from "@/server/db/schema/research-traces";
import { eq } from "drizzle-orm";

const MAX_ITERATIONS = 8;

const TOOL_DEFS: Anthropic.Tool[] = [
  ...financialToolDefinitions,
  ...webToolDefinitions,
  ...portfolioToolDefinitions,
].map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: t.inputSchema as Anthropic.Tool["input_schema"],
}));

const FINANCIAL_TOOL_NAMES = new Set(financialToolDefinitions.map((t) => t.name));
const WEB_TOOL_NAMES = new Set(webToolDefinitions.map((t) => t.name));
const PORTFOLIO_TOOL_NAMES = new Set(portfolioToolDefinitions.map((t) => t.name));

async function dispatchTool(
  toolName: string,
  input: unknown,
  db: DB,
  userId: string,
): Promise<string> {
  if (FINANCIAL_TOOL_NAMES.has(toolName)) {
    return runFinancialTool(toolName, input);
  }
  if (WEB_TOOL_NAMES.has(toolName)) {
    return runWebSearchTool(input);
  }
  if (PORTFOLIO_TOOL_NAMES.has(toolName)) {
    return runPortfolioTool(toolName, input, db, userId);
  }
  return JSON.stringify({ error: `Unknown tool: ${toolName}` });
}

export async function runResearchAgent(
  query: string,
  db: DB,
  userId: string,
  traceId: string,
): Promise<ResearchResult> {
  const systemPrompt = buildSystemPrompt([DCF_SKILL, TAX_EFFICIENCY_SKILL, FI_ANALYSIS_SKILL]);
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: query }];
  const trace: TraceEntry[] = [];
  let iterations = 0;

  // Mark running
  await db
    .update(researchTraces)
    .set({ status: "running" })
    .where(eq(researchTraces.id, traceId));

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    const response = await callLlm(messages, systemPrompt, TOOL_DEFS);

    // Collect all text + tool_use blocks from this response
    const toolCalls = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (response.stop_reason === "end_turn" || toolCalls.length === 0) {
      // Extract final answer
      const textBlock = response.content.find((b) => b.type === "text");
      const answer = textBlock && "text" in textBlock ? textBlock.text : "";

      await db
        .update(researchTraces)
        .set({
          status: "completed",
          answer,
          iterations,
          toolCalls: trace as unknown[],
          completedAt: new Date(),
        })
        .where(eq(researchTraces.id, traceId));

      return { traceId, answer, iterations, toolCalls: trace };
    }

    // Add assistant message
    messages.push({ role: "assistant", content: response.content });

    // Execute all tool calls (concurrent — all tools here are read-only)
    const toolResults = await Promise.all(
      toolCalls.map(async (tc) => {
        const start = Date.now();
        let output: string;
        let error: string | undefined;
        try {
          output = await dispatchTool(tc.name, tc.input, db, userId);
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
          output = JSON.stringify({ error });
        }
        const entry: TraceEntry = {
          iteration: iterations,
          toolName: tc.name,
          input: tc.input,
          output: JSON.parse(output),
          durationMs: Date.now() - start,
          ...(error ? { error } : {}),
        };
        trace.push(entry);
        return {
          type: "tool_result" as const,
          tool_use_id: tc.id,
          content: output,
        };
      }),
    );

    messages.push({ role: "user", content: toolResults });

    // Persist incremental trace
    await db
      .update(researchTraces)
      .set({ iterations, toolCalls: trace as unknown[] })
      .where(eq(researchTraces.id, traceId));
  }

  // Hit iteration limit — ask for a summary with what we have
  messages.push({
    role: "user",
    content:
      "You have reached the maximum number of tool calls. Please summarize your findings so far in a final answer.",
  });
  const finalResponse = await callLlm(messages, systemPrompt, []);
  const textBlock = finalResponse.content.find((b) => b.type === "text");
  const answer =
    textBlock && "text" in textBlock
      ? textBlock.text
      : "Analysis complete. See tool call trace for details.";

  await db
    .update(researchTraces)
    .set({
      status: "completed",
      answer,
      iterations,
      toolCalls: trace as unknown[],
      completedAt: new Date(),
    })
    .where(eq(researchTraces.id, traceId));

  return { traceId, answer, iterations, toolCalls: trace };
}
