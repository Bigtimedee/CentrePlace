"use client";

import type { MonteCarloResult } from "@/server/simulation/engine/monte-carlo-types";
import { MetricTile } from "@/components/ui/metric-tile";

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
        sub="25% of paths reach FI by this year"
        color="emerald"
      />
      <MetricTile
        label="Challenging FI"
        value={p75FiYear ? String(p75FiYear) : "—"}
        sub="75% of paths reach FI by this year"
        color="amber"
      />
    </div>
  );
}
