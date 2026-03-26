"use client";

import { trpc } from "@/lib/trpc";
import type { AllocationGap } from "@/server/portfolios/allocation-engine";
import type { ETFSuggestion } from "@/server/portfolios/etf-suggestions";

function Spinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
    </div>
  );
}

function formatPct(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return (value * 100).toFixed(1) + "%";
}

function GapBadge({ gap }: { gap: number }) {
  if (gap > 0.03) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        underweight
      </span>
    );
  }
  if (gap < -0.03) {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
        overweight
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
      on target
    </span>
  );
}

function AllocationRow({ g }: { g: AllocationGap }) {
  const labels: Record<string, string> = {
    equity: "Equity",
    bond: "Bonds",
    alt: "Alternatives",
  };
  return (
    <tr className="border-b border-gray-50">
      <td className="py-2 font-medium text-slate-800">{labels[g.assetClass] ?? g.assetClass}</td>
      <td className="py-2 text-right text-slate-700">{formatPct(g.current)}</td>
      <td className="py-2 text-right text-slate-700">{formatPct(g.recommended)}</td>
      <td className="py-2 text-right text-slate-700">
        <span className={g.gap > 0 ? "text-amber-700" : g.gap < 0 ? "text-blue-700" : "text-green-700"}>
          {g.gap > 0 ? "+" : ""}{formatPct(g.gap)}
        </span>
      </td>
      <td className="py-2 text-right">
        <GapBadge gap={g.gap} />
      </td>
    </tr>
  );
}

function SuggestionCard({ s }: { s: ETFSuggestion }) {
  const labels: Record<string, string> = {
    equity: "Equity",
    bond: "Bonds",
    alt: "Alternatives",
  };
  return (
    <div className="rounded-lg border border-gray-100 bg-slate-50 p-4">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-base font-bold text-slate-900">{s.ticker}</span>
          <p className="mt-0.5 text-xs text-slate-500">{s.name}</p>
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-gray-200">
          {labels[s.assetClass] ?? s.assetClass}
        </span>
      </div>
      <div className="mt-3 flex gap-4 text-xs text-slate-600">
        <span>
          <span className="font-medium">Expense ratio:</span>{" "}
          {s.expenseRatio != null ? formatPct(s.expenseRatio) : "N/A"}
        </span>
        <span>
          <span className="font-medium">3-yr return:</span>{" "}
          {s.threeYearReturn != null ? formatPct(s.threeYearReturn) : "N/A"}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">{s.justification}</p>
    </div>
  );
}

export function PortfolioIntelligencePanel() {
  const { data: simData, isLoading: simLoading } = trpc.simulation.run.useQuery(
    undefined,
    { retry: false, staleTime: 120_000 }
  );

  const { data: recommendation, isLoading: recLoading } =
    trpc.portfolios.getAllocationRecommendation.useQuery(
      {
        fiDateYear: simData?.fiDate?.year ?? null,
        isFI: simData ? simData.summary.gapToFI <= 0 : false,
      },
      { staleTime: 120_000 }
    );

  const { data: holdings, isLoading: holdingsLoading } =
    trpc.portfolios.listAllHoldings.useQuery();

  const underweightClasses = (recommendation?.gaps ?? [])
    .filter((g: AllocationGap) => g.gap > 0.03)
    .map((g: AllocationGap) => g.assetClass) as Array<"equity" | "bond" | "alt">;

  const { data: suggestions, isLoading: suggestionsLoading } =
    trpc.portfolios.getInvestmentSuggestions.useQuery(
      { underweightClasses },
      { enabled: underweightClasses.length > 0, staleTime: 300_000 }
    );

  // Don't render until we know if holdings exist
  if (holdingsLoading) return null;
  if (!holdings || holdings.length === 0) return null;

  const isLoading = simLoading || recLoading;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Portfolio Intelligence</h2>
        <p className="mt-1 text-sm text-slate-500">
          Age-based allocation analysis and low-cost ETF suggestions tailored to your FI timeline.
        </p>
      </div>

      {isLoading ? (
        <Spinner />
      ) : recommendation ? (
        <>
          {/* Allocation table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-left font-medium text-slate-600">Asset Class</th>
                  <th className="pb-2 text-right font-medium text-slate-600">Current</th>
                  <th className="pb-2 text-right font-medium text-slate-600">Recommended</th>
                  <th className="pb-2 text-right font-medium text-slate-600">Difference</th>
                  <th className="pb-2 text-right font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {recommendation.gaps.map((g: AllocationGap) => (
                  <AllocationRow key={g.assetClass} g={g} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Reasoning */}
          <p className="mt-4 text-sm text-slate-600">{recommendation.reasoning}</p>

          {/* Investment suggestions */}
          {underweightClasses.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 text-base font-semibold text-slate-900">Suggested Investments</h3>
              {suggestionsLoading ? (
                <Spinner />
              ) : suggestions && suggestions.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {suggestions.map((s: ETFSuggestion) => (
                    <SuggestionCard key={s.ticker} s={s} />
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {/* Methodology disclosure */}
          <details className="mt-6 text-xs text-slate-500">
            <summary className="cursor-pointer font-medium text-slate-600 hover:text-slate-800">
              Methodology disclosure
            </summary>
            <div className="mt-2 space-y-1 leading-relaxed">
              <p>
                Allocation recommendations use an age-based glide path: Aggressive (age &lt;40): 80/15/5.
                Moderate (age 40&ndash;55, &gt;5 years to FI): 65/25/10. Conservative (age &gt;55 or &le;5
                years to FI): 50/35/15. FI Achieved: 40/45/15.
              </p>
              <p>
                Investment suggestions are drawn from a curated list of low-cost, diversified ETFs per asset
                class (equity, bonds, alternatives). Selections are scored by estimated 3-year return weighted
                at 60% minus expense ratio weighted at 40%.
              </p>
              <p>
                Return and expense ratio data is sourced from Yahoo Finance via the yahoo-finance2 package and
                may be delayed or unavailable.
              </p>
              <p className="font-medium text-slate-600">
                GPRetire provides personalized investment recommendations based on your individual
                portfolio, timeline, and financial goals. All investment decisions are made solely
                at your own discretion and are your sole responsibility to evaluate and execute.
              </p>
            </div>
          </details>
        </>
      ) : null}
    </div>
  );
}
