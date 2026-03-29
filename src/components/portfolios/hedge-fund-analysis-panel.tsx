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

function SignalBadge({ signal }: { signal: string }) {
  if (signal === "bullish") {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
        BUY
      </span>
    );
  }
  if (signal === "bearish") {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
        SELL
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800">
      HOLD
    </span>
  );
}

type AgentSignal = {
  signal: string;
  conviction: number;
  reasoning: string;
};

type TickerResult = {
  signal: string;
  conviction: number;
  reasoning: string;
  agentSignals?: Record<string, AgentSignal>;
};

type PortfolioDecision = {
  action: string;
  quantity: number;
  confidence: number;
  reasoning: string;
};

// Format agent_name from snake_case to Title Case
function formatAgentName(key: string): string {
  return key
    .replace(/_agent$/, "")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function TickerResultCard({
  ticker,
  result,
  decision,
}: {
  ticker: string;
  result: TickerResult;
  decision?: PortfolioDecision;
}) {
  const [open, setOpen] = useState(false);
  const agentSignals = result.agentSignals ?? {};
  const agentEntries = Object.entries(agentSignals);

  return (
    <div className="rounded-lg border border-gray-100 bg-slate-50 p-4">
      <button
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-slate-900">{ticker}</span>
          <SignalBadge signal={result.signal} />
          <span className="text-xs text-slate-500">{result.conviction}% conviction</span>
        </div>
        <span className="text-xs text-slate-500">{open ? "hide" : "show"} details</span>
      </button>

      {result.reasoning && (
        <p className="mt-1.5 text-xs text-slate-500 ml-0">{result.reasoning}</p>
      )}

      {open && (
        <div className="mt-4 space-y-3">
          {decision && (
            <div className="rounded-md bg-white border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Portfolio Decision
              </p>
              <div className="flex items-center gap-3 mb-1">
                <span className={`text-sm font-bold uppercase ${
                  decision.action === "buy" ? "text-green-700"
                  : decision.action === "sell" || decision.action === "short" ? "text-red-700"
                  : "text-slate-600"
                }`}>
                  {decision.action}
                </span>
                {decision.quantity > 0 && (
                  <span className="text-xs text-slate-500">{decision.quantity} shares</span>
                )}
                <span className="text-xs text-slate-500">{decision.confidence}% confidence</span>
              </div>
              {decision.reasoning && (
                <p className="text-xs text-slate-600">{decision.reasoning}</p>
              )}
            </div>
          )}

          {agentEntries.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                Investor Signals
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left pb-1.5 pr-3 font-medium text-slate-500">Analyst</th>
                      <th className="text-left pb-1.5 pr-3 font-medium text-slate-500">Signal</th>
                      <th className="text-left pb-1.5 pr-3 font-medium text-slate-500">Conv.</th>
                      <th className="text-left pb-1.5 font-medium text-slate-500">Reasoning</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {agentEntries.map(([agentName, sig]) => (
                      <tr key={agentName}>
                        <td className="py-1.5 pr-3 font-medium text-slate-700 whitespace-nowrap">
                          {formatAgentName(agentName)}
                        </td>
                        <td className="py-1.5 pr-3">
                          <SignalBadge signal={sig.signal} />
                        </td>
                        <td className="py-1.5 pr-3 text-slate-600 whitespace-nowrap">
                          {sig.conviction}%
                        </td>
                        <td className="py-1.5 text-slate-500 leading-relaxed">
                          {sig.reasoning}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function HedgeFundAnalysisPanel() {
  const utils = trpc.useUtils();
  const { data: latestJob, isLoading: jobLoading } = trpc.hedgeFundAnalysis.getLatest.useQuery(
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

  const startMutation = trpc.hedgeFundAnalysis.start.useMutation({
    onSuccess: () => {
      void utils.hedgeFundAnalysis.getLatest.invalidate();
    },
  });

  const isActive = latestJob?.status === "pending" || latestJob?.status === "running";
  const results = latestJob?.results as Record<string, TickerResult> | null | undefined;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-800">
              <svg className="h-4 w-4 text-white" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            <h2 className="text-lg font-semibold text-slate-900">Hedge Fund Analysis</h2>
          </div>
          <p className="text-sm text-slate-500 ml-9">
            18 investor-persona agents modeled on Buffett, Munger, Cathie Wood, Graham, Burry, and others analyze your holdings via a LangGraph pipeline and produce conviction-weighted signals.
          </p>
        </div>
        <button
          onClick={() => startMutation.mutate()}
          disabled={isActive || startMutation.isPending || jobLoading}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {(isActive || startMutation.isPending) && <Spinner />}
          {isActive ? "Analyzing..." : "Run Hedge Fund Analysis"}
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
              <span>Hedge fund pipeline running. This typically takes 5 to 15 minutes depending on the number of tickers. This page will update automatically.</span>
            </div>
          )}

          {latestJob.status === "completed" && results && (
            <div className="space-y-3">
              {Object.entries(results).map(([ticker, result]) => (
                <TickerResultCard
                  key={ticker}
                  ticker={ticker}
                  result={result as TickerResult}
                />
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
            Analysis is performed by the ai-hedge-fund open-source project, which deploys 18 specialized
            AI agents modeled on renowned investors. A risk management layer and portfolio manager agent
            produce a final portfolio decision. The pipeline uses Anthropic Claude and financial data
            from Financial Datasets AI.
          </p>
          <p className="font-medium text-slate-600">
            CentrePlace provides AI-generated research summaries for informational purposes only. All
            investment decisions remain solely your responsibility.
          </p>
        </div>
      </details>
    </div>
  );
}
