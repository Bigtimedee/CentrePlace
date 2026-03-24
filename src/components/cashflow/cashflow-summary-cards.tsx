"use client";

import { formatCurrency } from "@/lib/utils";
import type { LiquidityTimelineResult } from "@/server/simulation/cashflow/types";

function MetricTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "amber" | "indigo" | "green" | "slate";
}) {
  const colors = {
    amber:  "text-amber-400",
    indigo: "text-indigo-400",
    green:  "text-emerald-400",
    slate:  "text-slate-100",
  };
  return (
    <div className="bg-slate-800/50 rounded-lg px-4 py-3">
      <p className="text-xs text-slate-600 mb-1">{label}</p>
      <p className={`text-lg font-semibold ${colors[accent ?? "slate"]}`}>{value}</p>
      {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
    </div>
  );
}

interface Props {
  totals: LiquidityTimelineResult["totals"];
  carryCount: number;
  lpCount: number;
}

export function CashflowSummaryCards({ totals, carryCount, lpCount }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <MetricTile
        label="GP Carry (net after tax)"
        value={formatCurrency(totals.totalNetCarry, true)}
        sub={`From ${carryCount} fund${carryCount !== 1 ? "s" : ""}`}
        accent="amber"
      />
      <MetricTile
        label="LP Distributions (net)"
        value={formatCurrency(totals.totalLPDistributions, true)}
        sub={`From ${lpCount} fund${lpCount !== 1 ? "s" : ""}`}
        accent="indigo"
      />
      <MetricTile
        label="Real Estate Proceeds (net)"
        value={formatCurrency(totals.totalRealEstateSaleProceeds, true)}
        sub="Projected sale proceeds"
        accent="green"
      />
      <MetricTile
        label="Total 40-yr Net Cash"
        value={formatCurrency(totals.grandTotalNet, true)}
        sub="All sources combined"
        accent="slate"
      />
    </div>
  );
}
