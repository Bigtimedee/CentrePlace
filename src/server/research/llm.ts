import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4096;

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export async function callLlm(
  messages: Anthropic.MessageParam[],
  systemPrompt: string,
  tools: Anthropic.Tool[],
): Promise<Anthropic.Message> {
  const client = getClient();

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        tools,
        messages,
      });
      return response;
    } catch (err) {
      const isRetryable =
        err instanceof Error &&
        (err.message.includes("529") ||
          err.message.includes("overloaded") ||
          err.message.includes("rate_limit"));
      if (!isRetryable || attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
  }
  throw new Error("unreachable");
}
