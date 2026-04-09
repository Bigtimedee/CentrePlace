import Anthropic from "@anthropic-ai/sdk";
import { callLlm } from "./llm";
import { buildSystemPromptWithDiscovery } from "./skills";
import { financialToolDefinitions, runFinancialTool } from "./tools/financials";
import { webToolDefinitions, runWebSearchTool } from "./tools/web-search";
import { portfolioToolDefinitions, runPortfolioTool } from "./tools/portfolio";
import { fdaToolDefinitions, runFdaTool } from "./tools/fda-tools";
import { loadSkillInstructions, discoverSkills } from "./skills/registry";
import { Scratchpad } from "./scratchpad";
import { microcompactMessages } from "./microcompaction";
import { shouldCompact, compactContext } from "./compaction";
import type { TraceEntry, ResearchResult } from "./types";
import type { DB } from "@/server/db/index";
import { researchTraces } from "@/server/db/schema/research-traces";
import { eq } from "drizzle-orm";

const MAX_ITERATIONS = 10;

const INVOKE_SKILL_TOOL: Anthropic.Tool = {
  name: "invoke_skill",
  description:
    "Retrieve full instructions for a named analytical skill. Call this before applying a skill to get step-by-step guidance.",
  input_schema: {
    type: "object" as const,
    properties: {
      skill_name: {
        type: "string",
        description: "The name of the skill to invoke, e.g. 'dcf-valuation'",
      },
    },
    required: ["skill_name"],
  },
};

const TOOL_DEFS: Anthropic.Tool[] = [
  ...financialToolDefinitions,
  ...webToolDefinitions,
  ...portfolioToolDefinitions,
  ...fdaToolDefinitions,
].map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: t.inputSchema as Anthropic.Tool["input_schema"],
}));

const ALL_TOOL_DEFS: Anthropic.Tool[] = [...TOOL_DEFS, INVOKE_SKILL_TOOL];

const FINANCIAL_TOOL_NAMES = new Set(financialToolDefinitions.map((t) => t.name));
const WEB_TOOL_NAMES = new Set(webToolDefinitions.map((t) => t.name));
const PORTFOLIO_TOOL_NAMES = new Set(portfolioToolDefinitions.map((t) => t.name));
const FDA_TOOL_NAMES = new Set(fdaToolDefinitions.map((t) => t.name));

function handleInvokeSkill(input: unknown): string {
  const { skill_name } = input as { skill_name: string };
  if (!skill_name) {
    return JSON.stringify({ error: "skill_name is required" });
  }
  try {
    const skills = discoverSkills();
    const skill = skills.find((s) => s.name === skill_name);
    if (!skill) {
      const available = skills.map((s) => s.name).join(", ");
      return JSON.stringify({
        error: `Skill '${skill_name}' not found. Available skills: ${available}`,
      });
    }
    const instructions = loadSkillInstructions(skill.filePath);
    return JSON.stringify({ skill_name, instructions });
  } catch (err) {
    return JSON.stringify({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function dispatchTool(
  toolName: string,
  input: unknown,
  db: DB,
  userId: string,
): Promise<string> {
  if (toolName === "invoke_skill") {
    return handleInvokeSkill(input);
  }
  if (FINANCIAL_TOOL_NAMES.has(toolName)) {
    return runFinancialTool(toolName, input);
  }
  if (WEB_TOOL_NAMES.has(toolName)) {
    return runWebSearchTool(input);
  }
  if (PORTFOLIO_TOOL_NAMES.has(toolName)) {
    return runPortfolioTool(toolName, input, db, userId);
  }
  if (FDA_TOOL_NAMES.has(toolName)) {
    return runFdaTool(toolName, input);
  }
  return JSON.stringify({ error: `Unknown tool: ${toolName}` });
}

export async function runResearchAgent(
  query: string,
  db: DB,
  userId: string,
  traceId: string,
): Promise<ResearchResult> {
  const systemPrompt = buildSystemPromptWithDiscovery();
  const scratchpad = new Scratchpad(traceId);
  scratchpad.addInit(query);

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: query }];
  const trace: TraceEntry[] = [];
  let iterations = 0;

  // Mark running
  await db
    .update(researchTraces)
    .set({ status: "running" })
    .where(eq(researchTraces.id, traceId));

  // Planning phase: ask the model to state its research plan before any tool calls
  const planResponse = await callLlm(messages, systemPrompt, []);
  const planBlock = planResponse.content.find((b) => b.type === "text");
  if (planBlock && "text" in planBlock && planBlock.text) {
    scratchpad.addThinking(`[Plan] ${planBlock.text}`);
    messages.push({ role: "assistant", content: planResponse.content });
    messages.push({
      role: "user",
      content: "Good. Now proceed with your research plan using the available tools.",
    });
  }

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    // Microcompaction: trim old tool results if context is growing
    const microResult = microcompactMessages(messages);
    if (microResult.trigger !== null) {
      // Replace in place — microcompactMessages returns a new array when triggered
      messages.length = 0;
      messages.push(...microResult.messages);
    }

    const response = await callLlm(messages, systemPrompt, ALL_TOOL_DEFS);

    // Collect all tool_use blocks from this response
    const toolCalls = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (response.stop_reason === "end_turn" || toolCalls.length === 0) {
      // Self-validation: if we have budget remaining, do one validation pass
      if (iterations <= MAX_ITERATIONS - 2) {
        const textBlock = response.content.find((b) => b.type === "text");
        const draftAnswer = textBlock && "text" in textBlock ? textBlock.text : "";

        messages.push({ role: "assistant", content: response.content });
        messages.push({
          role: "user",
          content:
            "Before finalizing, review your answer. Are there any gaps, unsupported claims, or missing data? If so, use tools to fill them. If the answer is complete and well-supported, respond with your final answer.",
        });

        const validationResponse = await callLlm(messages, systemPrompt, ALL_TOOL_DEFS);
        const validationToolCalls = validationResponse.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
        );

        if (validationResponse.stop_reason === "end_turn" || validationToolCalls.length === 0) {
          // Validation confirmed — use the validation response as final answer
          const validatedBlock = validationResponse.content.find((b) => b.type === "text");
          const answer =
            validatedBlock && "text" in validatedBlock
              ? validatedBlock.text
              : draftAnswer;

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

        // Validation found gaps — continue the loop with the validation tool calls
        messages.push({ role: "assistant", content: validationResponse.content });

        const validationResults = await Promise.all(
          validationToolCalls.map(async (tc) => {
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
            scratchpad.addToolResult(entry);
            return {
              type: "tool_result" as const,
              tool_use_id: tc.id,
              content: output,
            };
          }),
        );

        messages.push({ role: "user", content: validationResults });
        continue;
      }

      // No budget for validation — finalize directly
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

    // Add assistant message with tool calls
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
        scratchpad.addToolResult(entry);
        return {
          type: "tool_result" as const,
          tool_use_id: tc.id,
          content: output,
        };
      }),
    );

    messages.push({ role: "user", content: toolResults });

    // Full compaction: summarize context if it's grown too large
    const compactionResult = await compactContext({
      messages,
      systemPrompt,
      traceLength: trace.length,
      estimatedTokens: 0, // shouldCompact re-estimates internally
    });
    if (compactionResult.compacted) {
      messages.length = 0;
      messages.push(...compactionResult.messages);
      scratchpad.addCompaction(compactionResult.summary);
    }

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
