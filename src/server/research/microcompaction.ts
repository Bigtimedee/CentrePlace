import type Anthropic from "@anthropic-ai/sdk";

export type MicrocompactTrigger = "count" | "tokens" | null;

export interface MicrocompactResult {
  messages: Anthropic.MessageParam[];
  trigger: MicrocompactTrigger;
  removedTurns: number;
}

/** A "turn" is an assistant message + the subsequent user message of tool results. */
interface Turn {
  assistantIdx: number;
  toolResultIdx: number;
}

function isToolResultUserMessage(msg: Anthropic.MessageParam): boolean {
  return (
    msg.role === "user" &&
    Array.isArray(msg.content) &&
    msg.content.length > 0 &&
    (msg.content as Anthropic.ToolResultBlockParam[]).every(
      (b) => b.type === "tool_result",
    )
  );
}

function estimateChars(msg: Anthropic.MessageParam): number {
  if (!Array.isArray(msg.content)) return 0;
  let total = 0;
  for (const block of msg.content as Anthropic.ToolResultBlockParam[]) {
    if (block.type === "tool_result") {
      const c = block.content;
      if (typeof c === "string") total += c.length;
      else if (Array.isArray(c)) {
        for (const cb of c) {
          if (cb.type === "text") total += cb.text.length;
        }
      }
    }
  }
  return total;
}

const COUNT_THRESHOLD = 8;
const TOKEN_THRESHOLD = 60_000;
const KEEP_RECENT_TURNS = 4;

/**
 * Lightweight per-turn trimming of accumulated tool results in message history.
 *
 * Triggers:
 *  - count: more than COUNT_THRESHOLD tool-result user messages
 *  - tokens: estimated tokens (chars / 3.5) across all tool-result content > TOKEN_THRESHOLD
 *
 * When triggered, keeps only the KEEP_RECENT_TURNS most recent turns
 * (assistant + tool-results pairs), plus the original user query message.
 *
 * Returns the original array reference when no trigger fires (zero-copy fast path).
 */
export function microcompactMessages(
  messages: Anthropic.MessageParam[],
): MicrocompactResult {
  // Collect all (assistant, toolResult) turn pairs
  const turns: Turn[] = [];
  for (let i = 0; i < messages.length - 1; i++) {
    if (
      messages[i].role === "assistant" &&
      isToolResultUserMessage(messages[i + 1])
    ) {
      turns.push({ assistantIdx: i, toolResultIdx: i + 1 });
    }
  }

  const toolResultMessages = turns.map((t) => messages[t.toolResultIdx]);
  const totalChars = toolResultMessages.reduce(
    (sum, m) => sum + estimateChars(m),
    0,
  );
  const estimatedTokens = totalChars / 3.5;

  let trigger: MicrocompactTrigger = null;
  if (turns.length > COUNT_THRESHOLD) trigger = "count";
  else if (estimatedTokens > TOKEN_THRESHOLD) trigger = "tokens";

  if (trigger === null) {
    return { messages, trigger, removedTurns: 0 };
  }

  const turnsToKeep = turns.slice(-KEEP_RECENT_TURNS);
  const keepIndices = new Set<number>();
  for (const t of turnsToKeep) {
    keepIndices.add(t.assistantIdx);
    keepIndices.add(t.toolResultIdx);
  }

  const removedTurns = turns.length - turnsToKeep.length;

  // Always keep the first message (original user query)
  // Keep all messages NOT part of old turns (i.e., not in any turn's indices at all)
  const allTurnIndices = new Set<number>();
  for (const t of turns) {
    allTurnIndices.add(t.assistantIdx);
    allTurnIndices.add(t.toolResultIdx);
  }

  const compacted: Anthropic.MessageParam[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (!allTurnIndices.has(i) || keepIndices.has(i)) {
      compacted.push(messages[i]);
    }
  }

  return { messages: compacted, trigger, removedTurns };
}
