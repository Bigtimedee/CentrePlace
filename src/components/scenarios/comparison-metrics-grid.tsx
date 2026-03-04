"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { formatCurrency, formatPct } from "@/lib/utils";
import type { ScenarioRun } from "@/server/simulation/engine/scenario-types";
import { InfoModal } from "@/components/ui/info-modal";

interface Props {
  runs: ScenarioRun[];
}

interface MetricRow {
  label: string;
  info?: true; // renders an info trigger button next to the label
  getValue: (run: ScenarioRun) => string;
  accentFn?: (run: ScenarioRun, runs: ScenarioRun[]) => "positive" | "negative" | "neutral";
}

const CURRENT_YEAR = new Date().getFullYear();

// ── Metric definitions ────────────────────────────────────────────────────────

const METRICS: MetricRow[] = [
  {
    label: "FI Date",
    getValue: run =>
      run.result.fiDate
        ? `${run.result.fiDate.quarter} ${run.result.fiDate.year}`
        : "Not achieved",
    accentFn: (run, runs) => {
      if (!run.result.fiDate) return "negative";
      const earliest = Math.min(
        ...runs.filter(r => r.result.fiDate).map(r => r.result.fiDate!.year),
      );
      return run.result.fiDate.year === earliest ? "positive" : "neutral";
    },
  },
  {
    label: "FI Age",
    getValue: run =>
      run.result.fiAge !== null ? `Age ${run.result.fiAge}` : "—",
    accentFn: (run, runs) => {
      if (run.result.fiAge === null) return "negative";
      const youngest = Math.min(...runs.filter(r => r.result.fiAge !== null).map(r => r.result.fiAge!));
      return run.result.fiAge === youngest ? "positive" : "neutral";
    },
  },
  {
    label: "Years to FI",
    getValue: run => {
      if (!run.result.fiDate) return "—";
      const years = run.result.fiDate.year - CURRENT_YEAR;
      if (years <= 0) return "Already FI";
      return `${years} yr${years === 1 ? "" : "s"}`;
    },
    accentFn: (run, runs) => {
      if (!run.result.fiDate) return "negative";
      const years = run.result.fiDate.year - CURRENT_YEAR;
      if (years <= 0) return "positive";
      const allYears = runs
        .filter(r => r.result.fiDate)
        .map(r => r.result.fiDate!.year - CURRENT_YEAR);
      const fewest = Math.min(...allYears);
      return years === fewest ? "positive" : "neutral";
    },
  },
  {
    label: "Capital Today",
    getValue: run => formatCurrency(run.result.summary.totalCapitalToday, true),
  },
  {
    label: "Required for FI",
    getValue: run => formatCurrency(run.result.summary.requiredCapitalToday, true),
  },
  {
    label: "Gap to FI",
    getValue: run => {
      const gap = run.result.summary.gapToFI;
      if (gap <= 0) return "Already FI";
      return formatCurrency(gap, true);
    },
    accentFn: (run, runs) => {
      const gap = run.result.summary.gapToFI;
      if (gap <= 0) return "positive";
      const minGap = Math.min(...runs.map(r => r.result.summary.gapToFI));
      return gap === minGap ? "positive" : "neutral";
    },
  },
  {
    label: "% Funded Today",
    getValue: run => {
      const { totalCapitalToday, requiredCapitalToday } = run.result.summary;
      if (requiredCapitalToday <= 0) return "100%";
      return formatPct(Math.min(1, totalCapitalToday / requiredCapitalToday));
    },
    accentFn: (run, runs) => {
      const { totalCapitalToday, requiredCapitalToday } = run.result.summary;
      const pct = requiredCapitalToday > 0 ? totalCapitalToday / requiredCapitalToday : 1;
      if (pct >= 1) return "positive";
      const maxPct = Math.max(
        ...runs.map(r => {
          const { totalCapitalToday: t, requiredCapitalToday: rq } = r.result.summary;
          return rq > 0 ? t / rq : 1;
        }),
      );
      return pct === maxPct ? "positive" : "neutral";
    },
  },
  {
    label: "Annual Spending",
    getValue: run => formatCurrency(run.result.summary.projectedAnnualSpending, true),
  },
  {
    label: "Permanent Income",
    info: true,
    getValue: run => formatCurrency(run.result.summary.permanentAnnualIncome, true),
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function ComparisonMetricsGrid({ runs }: Props) {
  const [showPermanentIncomeInfo, setShowPermanentIncomeInfo] = useState(false);

  return (
    <>
      <div>
        <h3 className="text-sm font-semibold text-slate-100 mb-4">Side-by-Side Metrics</h3>

        {/* Column headers */}
        <div
          className="grid gap-0 rounded-t-xl overflow-hidden border border-b-0 border-slate-800"
          style={{ gridTemplateColumns: `160px repeat(${runs.length}, 1fr)` }}
        >
          <div className="bg-slate-800/30 px-4 py-2.5 text-xs font-medium text-slate-500 border-r border-slate-800">
            Metric
          </div>
          {runs.map(run => (
            <div
              key={run.scenarioId}
              className="bg-slate-800/30 px-4 py-2.5 text-center border-r border-slate-800 last:border-r-0"
            >
              <span className="text-xs font-semibold" style={{ color: run.color }}>
                {run.name}
              </span>
            </div>
          ))}
        </div>

        {/* Metric rows */}
        <div className="rounded-b-xl overflow-hidden border border-slate-800">
          {METRICS.map((metric, i) => (
            <div
              key={metric.label}
              className={`grid gap-0 border-b border-slate-800 last:border-b-0 ${
                i % 2 === 0 ? "bg-slate-900" : "bg-slate-800/20"
              }`}
              style={{ gridTemplateColumns: `160px repeat(${runs.length}, 1fr)` }}
            >
              {/* Label */}
              <div className="px-4 py-2.5 text-xs text-slate-500 border-r border-slate-800 font-medium flex items-center gap-1.5">
                {metric.label}
                {metric.info && (
                  <button
                    onClick={() => setShowPermanentIncomeInfo(true)}
                    className="flex-shrink-0 rounded-full text-slate-600 hover:text-indigo-400 transition-colors"
                    aria-label="What is Permanent Income?"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Values */}
              {runs.map(run => {
                const accent = metric.accentFn ? metric.accentFn(run, runs) : "neutral";
                const textColor =
                  accent === "positive"
                    ? "text-emerald-400"
                    : accent === "negative"
                    ? "text-rose-400"
                    : "text-slate-200";

                return (
                  <div
                    key={run.scenarioId}
                    className={`px-4 py-2.5 text-center text-xs font-semibold font-mono border-r border-slate-800 last:border-r-0 ${textColor}`}
                  >
                    {metric.getValue(run)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Permanent Income info modal */}
      {showPermanentIncomeInfo && (
        <InfoModal
          title="What is Permanent Income?"
          onClose={() => setShowPermanentIncomeInfo(false)}
        >
          <p>
            <span className="font-semibold text-slate-100">Permanent Income</span> is the
            total net annual income your real estate portfolio generates on a recurring,
            indefinite basis — primarily from rental properties and commercial holdings you
            own today.
          </p>

          <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">How it&apos;s calculated</p>
            <p className="font-mono text-xs text-indigo-300">
              Permanent Income = Σ (Gross Rental Income − Operating Expenses) × Ownership %
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Only properties typed as <span className="text-slate-300">Rental</span> or{" "}
              <span className="text-slate-300">Commercial</span> in your Real Estate section
              are included. Primary residences and vacation properties are excluded.
            </p>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Why it matters for FI</p>
            <p>
              Permanent Income directly reduces how much investment capital you need to
              accumulate. The FI target is set by a perpetuity formula:
            </p>
            <p className="font-mono text-xs text-indigo-300 mt-1">
              Required Capital = (Annual Spending − Permanent Income) ÷ Return Rate
            </p>
            <p className="text-xs text-slate-400 mt-2">
              For example, if your annual spending is $300K, your permanent rental income is
              $50K/yr, and your assumed return rate is 7%, your required capital drops from
              $4.3M to $3.6M — a $700K reduction in the hurdle you must clear.
            </p>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Where to set this up</p>
            <p>
              Go to <span className="text-indigo-400 font-medium">Real Estate</span> in the
              left navigation. For each rental or commercial property, enter:
            </p>
            <ul className="mt-2 space-y-1 text-xs text-slate-400 list-disc list-inside">
              <li>Property type: <span className="text-slate-300">Rental</span> or <span className="text-slate-300">Commercial</span></li>
              <li>Annual gross rental income</li>
              <li>Annual operating expenses (taxes, insurance, maintenance, management fees)</li>
              <li>Your ownership percentage (100% if solely owned)</li>
            </ul>
          </div>

          <p className="text-xs text-slate-500">
            Tip: Only include income you expect to continue indefinitely after you stop
            working. If you plan to sell a property before or shortly after FI, exclude it
            or set its income to $0 — the sale proceeds will already appear in your capital
            projection.
          </p>
        </InfoModal>
      )}
    </>
  );
}
