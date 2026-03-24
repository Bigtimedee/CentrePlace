"use client";

import type { MonteCarloResult } from "@/server/simulation/engine/monte-carlo-types";

interface MetricTileProps {
  label: string;
  value: string;
  sub?: string;
  color: "emerald" | "indigo" | "amber" | "rose" | "slate";
}

function MetricTile({ label, value, sub, color }: MetricTileProps) {
  const valueClass = {
    emerald: "text-emerald-400",
    indigo: "text-indigo-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
    slate: "text-slate-400",
  }[color];

  return (
    <div className="flex-1 min-w-[160px] rounded-xl border border-slate-800 bg-slate-900 px-5 py-4">
      <p className="text-xs text-slate-600 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
    </div>
  );
}

interface Props {
  result: MonteCarloResult;
}

export function ForecastSummaryCards({ result }: Props) {
  const { medianFiYear, pFIByBaseYear, p25FiYear, p75FiYear, deterministicFiYear } = result;

  const pctLabel = `${Math.round(pFIByBaseYear * 100)}%`;
  const pctColor: "indigo" | "amber" | "rose" =
    pFIByBaseYear >= 0.7 ? "indigo" : pFIByBaseYear >= 0.5 ? "amber" : "rose";

  return (
    <div className="flex flex-wrap gap-4">
      <MetricTile
        label="Median FI Year"
        value={medianFiYear ? String(medianFiYear) : "—"}
        sub="P50 across 500 paths"
        color={medianFiYear ? "emerald" : "slate"}
      />
      <MetricTile
        label="Probability by Base Date"
        value={deterministicFiYear ? pctLabel : "—"}
        sub={deterministicFiYear ? `FI by ${deterministicFiYear}` : "No base date"}
        color={deterministicFiYear ? pctColor : "slate"}
      />
      <MetricTile
        label="Favorable FI"
        value={p25FiYear ? String(p25FiYear) : "—"}
        sub="75% of paths reach FI by this year"
        color="emerald"
      />
      <MetricTile
        label="Challenging FI"
        value={p75FiYear ? String(p75FiYear) : "—"}
        sub="25% of paths need until this year"
        color="amber"
      />
    </div>
  );
}
