"use client";

import { formatCurrency } from "@/lib/utils";
import type { CarrySensitivityResult } from "@/server/simulation/tax/projection-types";

interface Props {
  data: CarrySensitivityResult | null;
  isLoading: boolean;
}

const REALIZATION_LABELS: Record<number, string> = {
  0:    "0% — Total Loss",
  0.25: "25% — Bear Case",
  0.5:  "50% — Mid Case",
  0.75: "75% — Base Case",
  1:    "100% — Bull Case",
};

const REALIZATION_COLORS: Record<number, string> = {
  0:    "bg-rose-50 border-rose-200 text-rose-600",
  0.25: "bg-amber-50 border-amber-200 text-amber-600",
  0.5:  "bg-slate-50 border-slate-200 text-slate-500",
  0.75: "bg-indigo-50 border-indigo-200 text-indigo-600",
  1:    "bg-emerald-50 border-emerald-200 text-emerald-600",
};

export function CarrySensitivityPanel({ data, isLoading }: Props) {
  return (
    <div>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Carry Sensitivity</h3>
        <p className="text-xs text-slate-600 mt-0.5">
          How your FI date and peak tax year shift across 5 carry outcome scenarios
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-32 text-slate-600 text-xs">
          Running scenarios…
        </div>
      )}

      {!isLoading && (!data || data.baseCarryGross === 0) && (
        <div className="flex items-center justify-center h-32 text-slate-600 text-xs text-center px-4">
          No carry positions entered. Add carry positions on the Carry page to see sensitivity analysis.
        </div>
      )}

      {!isLoading && data && data.baseCarryGross > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-3">
            <span>Total gross carry: {formatCurrency(data.baseCarryGross, true)}</span>
          </div>

          <div className="grid grid-cols-5 gap-1 text-xs text-slate-600 font-medium mb-1 px-1">
            <span className="col-span-2">Scenario</span>
            <span className="text-right">Net Carry</span>
            <span className="text-right">FI Year</span>
            <span className="text-right">Peak Tax</span>
          </div>

          {data.points.map(pt => {
            const labelKey = pt.realizationPct;
            const label = REALIZATION_LABELS[labelKey] ?? `${Math.round(pt.realizationPct * 100)}%`;
            const colorClass = REALIZATION_COLORS[labelKey] ?? "bg-slate-50 border-slate-200 text-slate-500";

            return (
              <div key={pt.realizationPct} className={`border rounded-lg px-3 py-2 ${colorClass}`}>
                <div className="grid grid-cols-5 gap-1 items-center">
                  <span className="col-span-2 text-xs font-medium">{label}</span>
                  <span className="text-right text-xs font-mono">
                    {formatCurrency(pt.totalNetCarry, true)}
                  </span>
                  <span className="text-right text-xs font-semibold">
                    {pt.fiYear ?? "Never"}
                    {pt.fiAge != null && ` (${pt.fiAge})`}
                  </span>
                  <span className="text-right text-xs font-mono">
                    {pt.peakTaxAmount > 0 ? formatCurrency(pt.peakTaxAmount, true) : "—"}
                  </span>
                </div>
              </div>
            );
          })}

          <p className="mt-2 text-xs text-slate-600">
            FI Year shows (age at FI). Peak Tax is the largest single-year tax bill in the 40-yr window.
          </p>
        </div>
      )}
    </div>
  );
}
