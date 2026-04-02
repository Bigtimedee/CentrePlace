"use client";

import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import type { TraceEntry } from "@/server/research/types";
import { ChevronDown, ChevronUp, Search, Loader2 } from "lucide-react";

const SUGGESTED_QUERIES = [
  "What is my portfolio's current allocation vs. recommended for my FI timeline?",
  "Analyze Apple (AAPL) — DCF valuation and buy/hold/sell recommendation",
  "Which of my holdings are tax-inefficient and should move to tax-advantaged accounts?",
  "What are the best low-cost ETFs to rebalance my equity underweight?",
];

function TracePanel({ entries }: { entries: TraceEntry[] }) {
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="mt-4 rounded-lg border border-gray-100 text-xs"
    >
      <summary className="flex cursor-pointer items-center justify-between px-4 py-2 font-medium text-slate-600 hover:text-slate-800 select-none">
        <span>{entries.length} tool call{entries.length !== 1 ? "s" : ""}</span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </summary>
      <div className="divide-y divide-gray-50 px-4 pb-3">
        {entries.map((e, i) => (
          <div key={i} className="py-2">
            <div className="flex items-center justify-between">
              <span className="font-mono font-semibold text-slate-700">{e.toolName}</span>
              <span className="text-slate-400">{e.durationMs}ms</span>
            </div>
            {e.error && (
              <p className="mt-0.5 text-red-600">{e.error}</p>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}

function AnswerBlock({ answer, toolCalls, iterations }: {
  answer: string;
  toolCalls: TraceEntry[];
  iterations: number;
}) {
  return (
    <div className="mt-4 rounded-xl border border-gray-100 bg-slate-50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-slate-400">
          Research Answer
        </span>
        <span className="text-xs text-slate-400">{iterations} iteration{iterations !== 1 ? "s" : ""}</span>
      </div>
      <div className="prose prose-sm max-w-none text-slate-800 whitespace-pre-wrap leading-relaxed">
        {answer}
      </div>
      <TracePanel entries={toolCalls} />
    </div>
  );
}

export function ResearchPanel() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{
    answer: string;
    toolCalls: TraceEntry[];
    iterations: number;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mutation = trpc.research.run.useMutation({
    onSuccess: (data) => {
      setResult({
        answer: data.answer,
        toolCalls: data.toolCalls,
        iterations: data.iterations,
      });
    },
  });

  function handleSubmit(q?: string) {
    const text = q ?? query;
    if (!text.trim() || mutation.isPending) return;
    setResult(null);
    mutation.mutate({ query: text.trim() });
    if (q) setQuery(q);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <div className="mb-1 flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#C8A45A]">
            <Search className="h-4 w-4 text-white" />
          </span>
          <h2 className="text-lg font-semibold text-slate-900">Financial Research</h2>
        </div>
        <p className="ml-9 text-sm text-slate-500">
          Ask anything about your portfolio, a company, or your FI plan. The agent calls live financial data APIs autonomously.
        </p>
      </div>

      {/* Query input */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Ask a research question…"
          rows={3}
          disabled={mutation.isPending}
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-[#C8A45A] focus:outline-none focus:ring-2 focus:ring-[#C8A45A]/20 disabled:opacity-50"
        />
        <button
          onClick={() => handleSubmit()}
          disabled={!query.trim() || mutation.isPending}
          className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-md bg-[#C8A45A] text-white transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer"
          aria-label="Run research"
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Suggested queries */}
      {!mutation.isPending && !result && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTED_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => handleSubmit(q)}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 transition-colors hover:border-[#C8A45A] hover:text-[#C8A45A] cursor-pointer"
            >
              {q.length > 55 ? q.slice(0, 55) + "…" : q}
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {mutation.isPending && (
        <div className="mt-5 flex items-center gap-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span>Researching — calling financial data APIs…</span>
        </div>
      )}

      {/* Error */}
      {mutation.isError && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {mutation.error.message}
        </div>
      )}

      {/* Result */}
      {result && (
        <AnswerBlock
          answer={result.answer}
          toolCalls={result.toolCalls}
          iterations={result.iterations}
        />
      )}

      {/* Disclosure */}
      <p className="mt-4 text-xs text-slate-400">
        Financial data sourced from Financial Modeling Prep. Not financial advice.
      </p>
    </div>
  );
}
