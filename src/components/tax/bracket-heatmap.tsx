"use client";

import { formatCurrency, formatPct } from "@/lib/utils";
import type { AnnualTaxProjection } from "@/server/simulation/tax/projection-types";

interface Props {
  projections: AnnualTaxProjection[];
}

function headroomColor(headroom: number): string {
  if (headroom > 200_000) return "text-emerald-400 bg-emerald-950/30";
  if (headroom > 50_000)  return "text-amber-400 bg-amber-950/30";
  if (headroom > 0)       return "text-rose-400 bg-rose-950/30";
  return "text-slate-600 bg-slate-800/30"; // already past threshold
}

function rateColor(rate: number): string {
  if (rate <= 0.15) return "text-emerald-400";
  if (rate <= 0.25) return "text-amber-400";
  return "text-rose-400";
}

export function BracketHeatmap({ projections }: Props) {
  // Show the first 15 years (most actionable)
  const rows = projections.slice(0, 15);

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-100">Bracket Headroom Analysis</h3>
        <p className="text-xs text-slate-600 mt-0.5">
          How close you are to the next tax bracket each year — first 15 years shown
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left text-slate-600 font-medium pb-2 pr-3">Year</th>
              <th className="text-left text-slate-600 font-medium pb-2 pr-3">Age</th>
              <th className="text-right text-slate-600 font-medium pb-2 pr-3">Marginal Ord.</th>
              <th className="text-right text-slate-600 font-medium pb-2 pr-3">Headroom → 25%</th>
              <th className="text-right text-slate-600 font-medium pb-2 pr-3">LTCG Rate</th>
              <th className="text-right text-slate-600 font-medium pb-2">LTCG 0% Room</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={p.year} className={i % 2 === 0 ? "bg-slate-800/20" : ""}>
                <td className="py-1.5 pr-3 text-slate-300 font-medium">{p.year}</td>
                <td className="py-1.5 pr-3 text-slate-600">{p.age}</td>
                <td className={`py-1.5 pr-3 text-right font-semibold ${rateColor(p.marginalOrdinaryRate)}`}>
                  {formatPct(p.marginalOrdinaryRate)}
                </td>
                <td className="py-1.5 pr-3 text-right">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${headroomColor(p.ordinaryBracketHeadroom)}`}>
                    {p.ordinaryBracketHeadroom > 0 ? formatCurrency(p.ordinaryBracketHeadroom, true) : "—"}
                  </span>
                </td>
                <td className={`py-1.5 pr-3 text-right font-semibold ${rateColor(p.marginalLtcgRate)}`}>
                  {formatPct(p.marginalLtcgRate)}
                </td>
                <td className="py-1.5 text-right">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${headroomColor(p.ltcgZeroBracketHeadroom)}`}>
                    {p.ltcgZeroBracketHeadroom > 0 ? formatCurrency(p.ltcgZeroBracketHeadroom, true) : "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-600">
        Green = &gt;$200K headroom · Amber = $50K–$200K · Red = &lt;$50K (near bracket boundary)
      </p>
    </div>
  );
}
