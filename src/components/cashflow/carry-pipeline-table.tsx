"use client";

import { formatCurrency, formatPct } from "@/lib/utils";
import type { CarryFundSummary } from "@/server/simulation/cashflow/types";

interface Props {
  funds: CarryFundSummary[];
}

export function CarryPipelineTable({ funds }: Props) {
  if (funds.length === 0) {
    return (
      <p className="text-sm text-slate-600 text-center py-4">
        No carry positions. Add carry positions to see your GP pipeline.
      </p>
    );
  }

  // Sort by realization year
  const sorted = [...funds].sort((a, b) => a.realizationYear - b.realizationYear || a.fundName.localeCompare(b.fundName));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-800">
            <th className="text-left text-slate-600 font-medium pb-2 pr-3">Fund</th>
            <th className="text-right text-slate-600 font-medium pb-2 pr-3">Vintage</th>
            <th className="text-right text-slate-600 font-medium pb-2 pr-3">Carry %</th>
            <th className="text-right text-slate-600 font-medium pb-2 pr-3">TVPI</th>
            <th className="text-right text-slate-600 font-medium pb-2 pr-3">Gross Carry</th>
            <th className="text-right text-slate-600 font-medium pb-2 pr-3">Haircut</th>
            <th className="text-right text-slate-600 font-medium pb-2 pr-3">Net Carry</th>
            <th className="text-right text-slate-600 font-medium pb-2 pr-3">Realization</th>
            <th className="text-right text-slate-600 font-medium pb-2 pr-3">Est. Tax</th>
            <th className="text-right text-slate-600 font-medium pb-2 pr-3">Net After Tax</th>
            <th className="text-right text-slate-600 font-medium pb-2">Pipeline</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((f, i) => (
            <tr key={f.fundName} className={i % 2 === 0 ? "bg-slate-800/20" : ""}>
              <td className="py-1.5 pr-3 text-slate-200 font-medium max-w-[160px] truncate">{f.fundName}</td>
              <td className="py-1.5 pr-3 text-right text-slate-600">{f.vintageYear}</td>
              <td className="py-1.5 pr-3 text-right text-slate-400">{formatPct(f.carryPct)}</td>
              <td className="py-1.5 pr-3 text-right text-slate-400">{f.currentTvpi.toFixed(2)}×</td>
              <td className="py-1.5 pr-3 text-right text-slate-300 font-mono">{formatCurrency(f.expectedGrossCarry, true)}</td>
              <td className="py-1.5 pr-3 text-right text-slate-600">{formatPct(f.haircutPct)}</td>
              <td className="py-1.5 pr-3 text-right text-amber-400 font-semibold font-mono">{formatCurrency(f.netCarry, true)}</td>
              <td className="py-1.5 pr-3 text-right text-slate-400">
                {f.realizationQuarter} {f.realizationYear}
              </td>
              <td className="py-1.5 pr-3 text-right text-rose-400 font-mono">~{formatCurrency(f.estimatedTax, true)}</td>
              <td className="py-1.5 pr-3 text-right text-emerald-400 font-semibold font-mono">{formatCurrency(f.netAfterTax, true)}</td>
              <td className="py-1.5 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${Math.round(f.pipelineSharePct * 100)}%` }}
                    />
                  </div>
                  <span className="text-slate-600 text-xs w-8 text-right">
                    {Math.round(f.pipelineSharePct * 100)}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-800">
            <td colSpan={4} className="pt-2 text-xs text-slate-600 font-medium">Total</td>
            <td className="pt-2 text-right text-slate-300 font-mono font-semibold text-xs pr-3">
              {formatCurrency(funds.reduce((s, f) => s + f.expectedGrossCarry, 0), true)}
            </td>
            <td />
            <td className="pt-2 text-right text-amber-400 font-semibold font-mono text-xs pr-3">
              {formatCurrency(funds.reduce((s, f) => s + f.netCarry, 0), true)}
            </td>
            <td />
            <td className="pt-2 text-right text-rose-400 font-mono text-xs pr-3">
              ~{formatCurrency(funds.reduce((s, f) => s + f.estimatedTax, 0), true)}
            </td>
            <td className="pt-2 text-right text-emerald-400 font-semibold font-mono text-xs pr-3">
              {formatCurrency(funds.reduce((s, f) => s + f.netAfterTax, 0), true)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
