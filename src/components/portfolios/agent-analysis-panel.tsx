"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

function Spinner() {
  return (
    <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
        completed
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
        failed
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
        running
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
      {status}
    </span>
  );
}

type TickerResult = {
  tradingAgents?: {
    final_trade_decision?: string;
    fundamentals_report?: string;
    sentiment_report?: string;
    news_report?: string;
    market_research_report?: string;
  };
  finRobot?: {
    research_report?: string;
  };
  error?: string;
};

function TickerResultCard({ ticker, result }: { ticker: string; result: TickerResult }) {
  const [open, setOpen] = useState(false);
  const ta = result.tradingAgents;
  const fr = result.finRobot;

  return (
    <div className="rounded-lg border border-gray-100 bg-slate-50 p-4">
      <button
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="text-base font-bold text-slate-900">{ticker}</span>
        <span className="text-xs text-slate-500">{open ? "hide" : "show"} details</span>
      </button>

      {result.error && (
        <p className="mt-2 text-xs text-red-600">{result.error}</p>
      )}

      {open && (
        <div className="mt-4 space-y-4">
          {ta?.final_trade_decision && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Trade Decision
              </p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{ta.final_trade_decision}</p>
            </div>
          )}
          {ta?.fundamentals_report && (
            <details>
              <summary className="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-800">
                Fundamentals Report
              </summary>
              <p className="mt-1 text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{ta.fundamentals_report}</p>
            </details>
          )}
          {ta?.sentiment_report && (
            <details>
              <summary className="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-800">
                Sentiment Report
              </summary>
              <p className="mt-1 text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{ta.sentiment_report}</p>
            </details>
          )}
          {ta?.news_report && (
            <details>
              <summary className="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-800">
                News Report
              </summary>
              <p className="mt-1 text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{ta.news_report}</p>
            </details>
          )}
          {ta?.market_research_report && (
            <details>
              <summary className="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-800">
                Market Research
              </summary>
              <p className="mt-1 text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{ta.market_research_report}</p>
            </details>
          )}
          {fr?.research_report && (
            <details>
              <summary className="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-800">
                Equity Research Report
              </summary>
              <p className="mt-1 text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{fr.research_report}</p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export function AgentAnalysisPanel() {
  const utils = trpc.useUtils();
  const { data: latestJob, isLoading: jobLoading } = trpc.agentAnalysis.getLatest.useQuery(
    undefined,
    {
      staleTime: 30_000,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        if (status === "pending" || status === "running") return 5_000;
        return false;
      },
    }
  );

  const startMutation = trpc.agentAnalysis.start.useMutation({
    onSuccess: () => {
      void utils.agentAnalysis.getLatest.invalidate();
    },
  });

  const isActive = latestJob?.status === "pending" || latestJob?.status === "running";
  const results = latestJob?.results as Record<string, TickerResult> | null | undefined;

  return (
    <div className="relative rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {/* Coming Soon overlay — remove once /analyze pipeline is verified working */}
      <div className="absolute inset-0 z-10 rounded-xl bg-white/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
        <span className="rounded-full bg-slate-100 border border-slate-200 px-4 py-1.5 text-sm font-semibold text-slate-500 tracking-wide uppercase">
          Coming Soon
        </span>
        <p className="text-xs text-slate-400">This feature is under development</p>
      </div>
      <div className="pointer-events-none select-none opacity-40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800">
              <svg className="h-4 w-4 text-white" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </span>
            <h2 className="text-lg font-semibold text-slate-900">AI Agent Analysis</h2>
          </div>
          <p className="text-sm text-slate-500 ml-9">
            Multi-agent investment research powered by TradingAgents. Runs in the background and analyzes
            your confirmed holdings using fundamentals, sentiment, news, and market data.
          </p>
        </div>
        <button
          onClick={() => startMutation.mutate()}
          disabled={isActive || startMutation.isPending || jobLoading}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {(isActive || startMutation.isPending) && <Spinner />}
          {isActive ? "Analyzing..." : "Run Analysis"}
        </button>
      </div>

      {startMutation.error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {startMutation.error.message}
        </div>
      )}

      {latestJob && (
        <div className="mt-6">
          <div className="flex items-center gap-3 mb-4">
            <StatusBadge status={latestJob.status} />
            {Array.isArray(latestJob.tickers) && (
              <span className="text-xs text-slate-500">
                Tickers: {(latestJob.tickers as string[]).join(", ")}
              </span>
            )}
            {latestJob.completedAt && (
              <span className="text-xs text-slate-400">
                {new Date(latestJob.completedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>

          {latestJob.error && (
            <p className="text-sm text-red-600">{latestJob.error}</p>
          )}

          {isActive && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-4 text-sm text-blue-700">
              <Spinner />
              <span>Analysis in progress. This typically takes 2 to 5 minutes. This page will update automatically.</span>
            </div>
          )}

          {latestJob.status === "completed" && results && (
            <div className="space-y-3">
              {Object.entries(results).map(([ticker, result]) => (
                <TickerResultCard key={ticker} ticker={ticker} result={result as TickerResult} />
              ))}
            </div>
          )}
        </div>
      )}

      <details className="mt-6 text-xs text-slate-500">
        <summary className="cursor-pointer font-medium text-slate-600 hover:text-slate-800">
          Methodology disclosure
        </summary>
        <div className="mt-2 space-y-1 leading-relaxed">
          <p>
            Analysis is performed by TradingAgents, an open-source multi-agent framework that
            deploys specialized AI analysts for fundamentals, market sentiment, news, and technical
            analysis. A bull/bear researcher debate and a risk management layer produce a final
            trade decision.
          </p>
          <p className="font-medium text-slate-600">
            GPRetire provides AI-generated research summaries for informational purposes only. All
            investment decisions remain solely your responsibility.
          </p>
        </div>
      </details>
      </div>
    </div>
  );
}
