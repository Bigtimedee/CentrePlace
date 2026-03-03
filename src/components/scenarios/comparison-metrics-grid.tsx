"use client";

import { formatCurrency, formatPct } from "@/lib/utils";
import type { ScenarioRun } from "@/server/simulation/engine/scenario-types";

interface Props {
  runs: ScenarioRun[];
}

interface MetricRow {
  label: string;
  getValue: (run: ScenarioRun) => string;
  accentFn?: (run: ScenarioRun, runs: ScenarioRun[]) => "positive" | "negative" | "neutral";
}

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
    getValue: run => formatCurrency(run.result.summary.permanentAnnualIncome, true),
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function ComparisonMetricsGrid({ runs }: Props) {
  return (
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
            <div className="px-4 py-2.5 text-xs text-slate-500 border-r border-slate-800 font-medium">
              {metric.label}
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
  );
}
