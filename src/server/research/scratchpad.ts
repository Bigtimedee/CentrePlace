import fs from "fs";
import path from "path";
import type { TraceEntry } from "./types";

const SCRATCHPAD_DIR = path.join(process.cwd(), ".centreplace", "scratchpad");

function ensureDir(): void {
  if (!fs.existsSync(SCRATCHPAD_DIR)) {
    fs.mkdirSync(SCRATCHPAD_DIR, { recursive: true });
  }
}

function appendLine(filePath: string, entry: Record<string, unknown>): void {
  try {
    fs.appendFileSync(filePath, JSON.stringify(entry) + "\n", "utf-8");
  } catch {
    // Scratchpad is best-effort; never throw
  }
}

export class Scratchpad {
  private readonly filePath: string;

  constructor(traceId: string) {
    ensureDir();
    this.filePath = path.join(SCRATCHPAD_DIR, `${traceId}.jsonl`);
  }

  addInit(query: string): void {
    appendLine(this.filePath, { t: "init", ts: Date.now(), query });
  }

  addToolResult(entry: TraceEntry): void {
    appendLine(this.filePath, {
      t: "tool",
      ts: Date.now(),
      iteration: entry.iteration,
      toolName: entry.toolName,
      input: entry.input,
      durationMs: entry.durationMs,
      ...(entry.error ? { error: entry.error } : {}),
    });
  }

  addThinking(text: string): void {
    appendLine(this.filePath, { t: "thinking", ts: Date.now(), text });
  }

  addCompaction(summary: string): void {
    appendLine(this.filePath, { t: "compaction", ts: Date.now(), summary });
  }
}
