"use client";

import { trpc } from "@/lib/trpc";
import Link from "next/link";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    return "$" + (n / 1_000_000).toFixed(1) + "M";
  }
  if (Math.abs(n) >= 1_000) {
    return "$" + Math.round(n / 1_000) + "K";
  }
  return "$" + Math.round(n).toLocaleString("en-US");
}

function fmtPct(n: number): string {
  return (n * 100).toFixed(0) + "%";
}

// ── Circular progress ring ────────────────────────────────────────────────────

function CoverageRing({
  ratio,
  hasSurplus,
}: {
  ratio: number;
  hasSurplus: boolean;
}) {
  const clamped = Math.min(ratio, 1.5); // cap visual at 150%
  const pct = Math.min(clamped / 1.5, 1); // normalize to 0-1 for visual
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);

  const strokeColor = hasSurplus
    ? "#10b981" // emerald-500
    : ratio >= 0.75
    ? "#f59e0b" // amber-500
    : "#f43f5e"; // rose-500

  return (
    <div className="relative flex h-24 w-24 flex-shrink-0 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 88 88">
        {/* Track */}
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="8"
        />
        {/* Progress */}
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="z-10 text-center">
        <p className="text-lg font-bold leading-none text-slate-900">
          {fmtPct(ratio)}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">covered</p>
      </div>
    </div>
  );
}

// ── Income row ────────────────────────────────────────────────────────────────

function IncomeRow({
  label,
  amount,
  color,
}: {
  label: string;
  amount: number;
  color: string;
}) {
  if (amount <= 0) return null;
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${color}`} />
        <span className="text-sm text-slate-600">{label}</span>
      </div>
      <span className="text-sm font-medium text-slate-800 tabular-nums">
        {fmtMoney(amount)}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function IncomeGapCard() {
  const { data: simData, isLoading: simLoading } = trpc.simulation.run.useQuery(
    undefined,
    { retry: false, staleTime: 60_000 }
  );

  const { data: holdings, isLoading: holdingsLoading } =
    trpc.portfolios.listAllHoldings.useQuery();

  const {
    data: yieldSummary,
    isLoading: yieldLoading,
    refetch: refetchYield,
    isFetching: yieldFetching,
  } = trpc.portfolios.getPortfolioYieldSummary.useQuery(undefined, {
    // Don't auto-fetch — enrichment can be slow and consumes API quota.
    enabled: false,
    staleTime: 300_000,
  });

  const isLoading = simLoading || holdingsLoading;

  // ── Derive income figures from current-year simulation quarters ──────────────

  const currentYear = new Date().getFullYear();

  const currentYearQuarters = (simData?.quarters ?? []).filter(
    (q) => q.year === currentYear
  );

  const annualW2 = currentYearQuarters.reduce((s, q) => s + q.w2Income, 0);
  const annualLP = currentYearQuarters.reduce((s, q) => s + q.lpIncome, 0);
  const annualCarry = currentYearQuarters.reduce((s, q) => s + q.carryIncome, 0);
  const annualRental = currentYearQuarters.reduce(
    (s, q) => s + q.rentalNetIncome,
    0
  );
  // portfolioYieldIncome from simulation is based on account yield rates, not enriched FMP data.
  // We use the enriched yieldSummary when available, otherwise fall back to simulation yield.
  const simPortfolioYield = currentYearQuarters.reduce(
    (s, q) => s + q.portfolioYieldIncome,
    0
  );
  const enrichedYield = yieldSummary?.estimatedAnnualYieldIncome;
  const portfolioYieldDisplay =
    enrichedYield != null ? enrichedYield : simPortfolioYield;

  const annualSpending = simData?.summary.projectedAnnualSpending ?? 0;

  const totalIncome =
    annualW2 + portfolioYieldDisplay + annualRental + annualLP + annualCarry;
  const gap = annualSpending - totalIncome; // positive = gap, negative = surplus
  const hasSurplus = gap <= 0;
  const coverageRatio =
    annualSpending > 0 ? totalIncome / annualSpending : totalIncome > 0 ? 1.5 : 0;

  const hasNoHoldings = !holdingsLoading && (!holdings || holdings.length === 0);

  // ── Loading state ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-600">
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </span>
          <h2 className="text-lg font-semibold text-slate-900">Income Coverage</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
        </div>
      </div>
    );
  }

  // ── No simulation data ────────────────────────────────────────────────────────

  if (!simData) return null;

  // ── Main render ───────────────────────────────────────────────────────────────

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2.5 mb-1">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-600">
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </span>
          <h2 className="text-lg font-semibold text-slate-900">Income Coverage</h2>
        </div>
        <p className="text-sm text-slate-500 ml-9">
          How your income sources stack up against annual spending this year.
        </p>
      </div>

      {/* Body: ring + income list */}
      <div className="flex gap-6 items-start">
        {/* Coverage ring */}
        <CoverageRing ratio={coverageRatio} hasSurplus={hasSurplus} />

        {/* Income breakdown list */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
            Income Sources
          </p>
          <div className="divide-y divide-slate-50">
            <IncomeRow label="W-2 / Salary" amount={annualW2} color="bg-emerald-500" />
            <div className="py-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full flex-shrink-0 bg-sky-500" />
                  <span className="text-sm text-slate-600">Portfolio Yield</span>
                  {enrichedYield == null && !yieldFetching && (
                    <button
                      onClick={() => refetchYield()}
                      className="ml-1 rounded px-1.5 py-0.5 text-xs text-sky-600 hover:bg-sky-50 font-medium border border-sky-200"
                    >
                      Refresh Yield Data
                    </button>
                  )}
                  {yieldFetching && (
                    <span className="ml-1 text-xs text-slate-400 italic">fetching...</span>
                  )}
                  {yieldSummary?.estimatedAnnualYieldIncome == null && !yieldFetching && enrichedYield == null && simPortfolioYield > 0 && (
                    <span className="ml-1 text-xs text-slate-400 italic">(est.)</span>
                  )}
                </div>
                <span className="text-sm font-medium text-slate-800 tabular-nums">
                  {portfolioYieldDisplay > 0
                    ? fmtMoney(portfolioYieldDisplay)
                    : hasNoHoldings
                    ? "—"
                    : fmtMoney(portfolioYieldDisplay)}
                </span>
              </div>
              {hasNoHoldings && (
                <p className="mt-1 text-xs text-slate-400 ml-4">
                  Add portfolio holdings to see yield income.
                </p>
              )}
            </div>
            <IncomeRow label="Rental Net Income" amount={annualRental} color="bg-teal-500" />
            <IncomeRow label="LP Income" amount={annualLP} color="bg-[#C8A45A]" />
            <IncomeRow label="Carry Income" amount={annualCarry} color="bg-amber-500" />
          </div>

          {/* Total income row */}
          <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
            <span className="text-sm font-semibold text-slate-700">Total Income</span>
            <span className="text-sm font-bold text-slate-900 tabular-nums">
              {fmtMoney(totalIncome)}
            </span>
          </div>

          {/* Annual spending row */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Annual Spending</span>
            <span className="text-sm text-slate-600 tabular-nums">
              {fmtMoney(annualSpending)}
            </span>
          </div>
        </div>
      </div>

      {/* Gap / Surplus banner */}
      {annualSpending > 0 && (
        <div
          className={`mt-4 flex items-center justify-between rounded-lg px-4 py-2.5 ${
            hasSurplus
              ? "bg-emerald-50"
              : coverageRatio >= 0.75
              ? "bg-amber-50"
              : "bg-rose-50"
          }`}
        >
          <span
            className={`text-sm font-semibold ${
              hasSurplus
                ? "text-emerald-700"
                : coverageRatio >= 0.75
                ? "text-amber-700"
                : "text-rose-700"
            }`}
          >
            {hasSurplus
              ? `Income Surplus: ${fmtMoney(Math.abs(gap))}`
              : `Income Gap: ${fmtMoney(gap)}`}
          </span>
          <Link
            href="/cashflow"
            className={`text-xs font-medium hover:underline ${
              hasSurplus
                ? "text-emerald-600"
                : coverageRatio >= 0.75
                ? "text-amber-600"
                : "text-rose-600"
            }`}
          >
            See 12-Month Breakdown
          </Link>
        </div>
      )}
    </div>
  );
}
