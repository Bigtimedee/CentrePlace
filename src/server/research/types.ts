export interface TraceEntry {
  iteration: number;
  toolName: string;
  input: unknown;
  output: unknown;
  durationMs: number;
  error?: string;
}

export interface ResearchResult {
  traceId: string;
  answer: string;
  iterations: number;
  toolCalls: TraceEntry[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolCallBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}
