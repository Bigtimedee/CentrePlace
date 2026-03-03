"use client";

import { formatCurrency, formatPct } from "@/lib/utils";
import type { TaxPlanningResult } from "@/server/simulation/tax/projection-types";

function MetricTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "green" | "amber" | "red" | "indigo";
}) {
  const colors = {
    green: "text-emerald-400",
    amber: "text-amber-400",
    red: "text-rose-400",
    indigo: "text-indigo-400",
  };
  return (
    <div className="bg-slate-800/50 rounded-lg px-4 py-3">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-lg font-semibold ${accent ? colors[accent] : "text-slate-100"}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

interface Props {
  data: TaxPlanningResult;
}

export function TaxSummaryCards({ data }: Props) {
  const peakAccent = data.peakTaxAmount > 1_000_000 ? "red" : data.peakTaxAmount > 500_000 ? "amber" : undefined;
  const rateAccent = data.averageEffectiveTaxRate > 0.35 ? "red" : data.averageEffectiveTaxRate > 0.25 ? "amber" : "green";

  const totalCarryEvents = data.projections.reduce((s, p) => s + p.carryEvents.length, 0);
  const totalCarryTax = data.projections.reduce(
    (s, p) => s + p.carryEvents.reduce((ss, e) => ss + e.estimatedTax, 0),
    0,
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <MetricTile
        label="Total Tax (40-yr window)"
        value={formatCurrency(data.totalTaxOverWindow, true)}
        sub="Federal + state combined"
        accent="indigo"
      />
      <MetricTile
        label="Peak Tax Year"
        value={`${data.peakTaxYear}`}
        sub={formatCurrency(data.peakTaxAmount, true) + " estimated"}
        accent={peakAccent}
      />
      <MetricTile
        label="Avg Effective Rate"
        value={formatPct(data.averageEffectiveTaxRate)}
        sub="Across income-generating years"
        accent={rateAccent}
      />
      <MetricTile
        label="Carry Realizations"
        value={`${totalCarryEvents} event${totalCarryEvents !== 1 ? "s" : ""}`}
        sub={totalCarryTax > 0 ? `~${formatCurrency(totalCarryTax, true)} est. tax` : "No carry events"}
        accent={totalCarryEvents > 0 ? "amber" : undefined}
      />
    </div>
  );
}
