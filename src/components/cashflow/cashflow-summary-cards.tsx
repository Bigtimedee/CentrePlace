"use client";

import { formatCurrency } from "@/lib/utils";
import type { LiquidityTimelineResult } from "@/server/simulation/cashflow/types";
import { MetricTile } from "@/components/ui/metric-tile";

interface Props {
  totals: LiquidityTimelineResult["totals"];
  carryCount: number;
  lpCount: number;
}

export function CashflowSummaryCards({ totals, carryCount, lpCount }: Props) {
  return (
    <div className="flex flex-wrap gap-4">
      <MetricTile
        label="GP Carry (net after tax)"
        value={formatCurrency(totals.totalNetCarry, true)}
        sub={`From ${carryCount} fund${carryCount !== 1 ? "s" : ""}`}
        color="amber"
      />
      <MetricTile
        label="LP Distributions (net)"
        value={formatCurrency(totals.totalLPDistributions, true)}
        sub={`From ${lpCount} fund${lpCount !== 1 ? "s" : ""}`}
        color="indigo"
      />
      <MetricTile
        label="Real Estate Proceeds (net)"
        value={formatCurrency(totals.totalRealEstateSaleProceeds, true)}
        sub="Projected sale proceeds"
        color="emerald"
      />
      <MetricTile
        label="Total 40-yr Net Cash"
        value={formatCurrency(totals.grandTotalNet, true)}
        sub="All sources combined"
        color="slate"
      />
    </div>
  );
}
