"use client";

import { formatCurrency, formatPct } from "@/lib/utils";
import type { QuarterResult, SimulationResult } from "@/server/simulation/engine/types";
import { CheckCircle2 } from "lucide-react";

// ── Data preparation ──────────────────────────────────────────────────────────

/** Return the Q4 snapshot for every 5th year (milestones). Always include startYear + 1 and the FI year. */
function milestoneRows(result: SimulationResult): QuarterResult[] {
  const q4s = result.quarters.filter(q => q.quarterLabel === "Q4");
  const fiYear = result.fiDate?.year;

  const milestoneYears = new Set<number>();
  for (const q of q4s) {
    if ((q.year - result.startYear) % 5 === 0) milestoneYears.add(q.year);
  }
  if (fiYear) milestoneYears.add(fiYear);
  // Always show the first year
  if (q4s.length > 0) milestoneYears.add(q4s[0].year);

  return q4s
    .filter(q => milestoneYears.has(q.year))
    .sort((a, b) => a.year - b.year);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  result: SimulationResult;
}

export function AnnualSummaryTable({ result }: Props) {
  const rows = milestoneRows(result);
  const fiYear = result.fiDate?.year;

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-100">Milestone Snapshots</h3>
        <p className="text-xs text-slate-500 mt-0.5">Key years — Q4 balance sheet</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-800">
              {["Year", "Age", "Total Capital", "Required", "% Funded", "Inv. Capital", "RE Equity", "Annual Tax", "FI"].map(h => (
                <th key={h} className="pb-2 pr-4 text-left font-medium text-slate-500 last:pr-0">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {rows.map(row => {
              const pct = row.requiredCapital > 0
                ? Math.min(row.totalCapital / row.requiredCapital, 9.99)
                : 1;
              const isFIRow = fiYear === row.year;

              return (
                <tr
                  key={row.year}
                  className={`${isFIRow ? "bg-emerald-950/20" : ""} hover:bg-slate-800/20`}
                >
                  <td className={`py-2 pr-4 font-medium ${isFIRow ? "text-emerald-400" : "text-slate-200"}`}>
                    {row.year}
                  </td>
                  <td className="py-2 pr-4 text-slate-400">{row.age}</td>
                  <td className="py-2 pr-4 text-slate-100 font-semibold">
                    {formatCurrency(row.totalCapital, true)}
                  </td>
                  <td className="py-2 pr-4 text-slate-400">
                    {formatCurrency(row.requiredCapital, true)}
                  </td>
                  <td className="py-2 pr-4">
                    <span className={pct >= 1 ? "text-emerald-400" : "text-amber-400"}>
                      {formatPct(pct)}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-slate-400">
                    {formatCurrency(row.investmentCapital, true)}
                  </td>
                  <td className="py-2 pr-4 text-slate-400">
                    {formatCurrency(row.realEstateEquity, true)}
                  </td>
                  <td className="py-2 pr-4 text-slate-400">
                    {row.annualTotalTax > 0 ? formatCurrency(row.annualTotalTax, true) : "—"}
                  </td>
                  <td className="py-2 text-center">
                    {row.isFI && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 inline" />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
