import type Anthropic from "@anthropic-ai/sdk";
import { callLlm } from "./llm";

export interface CompactionInput {
  messages: Anthropic.MessageParam[];
  systemPrompt: string;
  traceLength: number;
  estimatedTokens: number;
}

export interface CompactionResult {
  messages: Anthropic.MessageParam[];
  summary: string;
  compacted: boolean;
}

const COMPACTION_TOKEN_THRESHOLD = 60_000;
const COMPACTION_TRACE_MIN = 4;

const COMPACTION_PROMPT = `You are summarizing a financial research session for context compaction.

Review the conversation above and produce a concise summary of:
1. The original research question
2. Key data gathered (specific numbers, companies, metrics)
3. Insights and conclusions reached so far
4. What still needs to be investigated

Format your summary inside <summary> tags. Be specific — include actual figures, ticker symbols, and reasoning chains that would be needed to continue the analysis.`;

/**
 * Estimate the total character count of tool result content in the message array.
 */
function estimateContextChars(messages: Anthropic.MessageParam[]): number {
  let total = 0;
  for (const msg of messages) {
    if (!Array.isArray(msg.content)) {
      total += typeof msg.content === "string" ? msg.content.length : 0;
      continue;
    }
    for (const block of msg.content) {
      if ("text" in block && typeof block.text === "string") {
        total += block.text.length;
      } else if (block.type === "tool_result") {
        const c = (block as Anthropic.ToolResultBlockParam).content;
        if (typeof c === "string") total += c.length;
        else if (Array.isArray(c)) {
          for (const cb of c) {
            if (cb.type === "text") total += cb.text.length;
          }
        }
      }
    }
  }
  return total;
}

/**
 * Extract text inside <summary>...</summary> tags from an LLM response.
 */
function extractSummary(response: Anthropic.Message): string {
  for (const block of response.content) {
    if (block.type === "text") {
      const match = block.text.match(/<summary>([\s\S]*?)<\/summary>/i);
      if (match) return match[1].trim();
      // Fallback: return the full text if no tags found
      return block.text.trim();
    }
  }
  return "";
}

/**
 * Determine whether full LLM-based compaction should be triggered.
 */
export function shouldCompact(input: CompactionInput): boolean {
  if (input.traceLength < COMPACTION_TRACE_MIN) return false;
  const chars = estimateContextChars(input.messages);
  const estimatedTokens = chars / 3.5;
  return estimatedTokens > COMPACTION_TOKEN_THRESHOLD;
}

/**
 * Perform full LLM-based context compaction.
 * Calls the LLM to summarize accumulated context, then replaces message
 * history with a continuation framing message.
 */
export async function compactContext(
  input: CompactionInput,
): Promise<CompactionResult> {
  if (!shouldCompact(input)) {
    return {
      messages: input.messages,
      summary: "",
      compacted: false,
    };
  }

  // Ask the LLM to summarize what has been learned so far
  const compactionMessages: Anthropic.MessageParam[] = [
    ...input.messages,
    { role: "user", content: COMPACTION_PROMPT },
  ];

  const response = await callLlm(compactionMessages, input.systemPrompt, []);
  const summary = extractSummary(response);

  if (!summary) {
    return { messages: input.messages, summary: "", compacted: false };
  }

  // Replace the full history with a continuation framing message
  const continuationMessage: Anthropic.MessageParam = {
    role: "user",
    content: `[Context compacted — continuing research session]\n\n${summary}\n\nPlease continue the analysis from where we left off.`,
  };

  return {
    messages: [continuationMessage],
    summary,
    compacted: true,
  };
}
