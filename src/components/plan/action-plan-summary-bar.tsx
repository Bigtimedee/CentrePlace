"use client";

import type { AnnualActionPlanResult, ActionCategory } from "@/server/simulation/plan/types";

// ── Category display names ─────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<ActionCategory, string> = {
  tax_optimization: "Tax Optimization",
  carry_timing: "Carry Timing",
  estate_planning: "Estate Planning",
  insurance_review: "Insurance Review",
  lp_distribution: "LP Distributions",
  fi_acceleration: "FI Acceleration",
  liquidity_planning: "Liquidity Planning",
};

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toFixed(0)}`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MetricTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-4">
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${accent ?? "text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function FIProgressBar({ pctFunded, isFI }: { pctFunded: number; isFI: boolean }) {
  const pct = Math.round(pctFunded * 100);
  const barColor = isFI ? "bg-emerald-500" : pct >= 75 ? "bg-indigo-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-slate-500">FI Progress</p>
        <span className={`text-sm font-bold tabular-nums ${isFI ? "text-emerald-400" : "text-white"}`}>
          {pct}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <p className="text-xs text-slate-500 mt-1.5">
        {isFI ? "Financial independence achieved" : `${pct}% of target capital funded`}
      </p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface ActionPlanSummaryBarProps {
  result: AnnualActionPlanResult;
}

export function ActionPlanSummaryBar({ result }: ActionPlanSummaryBarProps) {
  const { totalQuantifiedDollarImpact, doThisYearCount, topCategory, fiStatus, planYear, currentAge, items } = result;

  const doThisYearAccent =
    doThisYearCount === 0 ? "text-emerald-400" :
    doThisYearCount <= 2 ? "text-amber-400" :
    "text-rose-400";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricTile
        label={`${planYear} Quantified Opportunity`}
        value={totalQuantifiedDollarImpact > 0 ? formatCurrency(totalQuantifiedDollarImpact) : "—"}
        sub={`across ${items.length} action item${items.length !== 1 ? "s" : ""}`}
        accent="text-indigo-400"
      />

      <MetricTile
        label="Act Before Dec 31"
        value={`${doThisYearCount}`}
        sub={doThisYearCount === 0 ? "Nothing urgent — you're on top of it" : `item${doThisYearCount !== 1 ? "s" : ""} require action this year`}
        accent={doThisYearAccent}
      />

      <MetricTile
        label="Top Focus Area"
        value={topCategory ? CATEGORY_LABEL[topCategory] : "—"}
        sub={`age ${currentAge} · plan year ${planYear}`}
      />

      <FIProgressBar pctFunded={fiStatus.pctFunded} isFI={fiStatus.isFI} />
    </div>
  );
}
