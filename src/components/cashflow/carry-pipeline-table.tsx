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

  const totals = {
    grossCarry: funds.reduce((s, f) => s + f.expectedGrossCarry, 0),
    netCarry: funds.reduce((s, f) => s + f.netCarry, 0),
    estimatedTax: funds.reduce((s, f) => s + f.estimatedTax, 0),
    netAfterTax: funds.reduce((s, f) => s + f.netAfterTax, 0),
  };

  return (
    <>
      {/* Mobile card view */}
      <div className="sm:hidden space-y-3">
        {sorted.map((f) => (
          <div key={f.fundName} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="font-medium text-slate-700 truncate">{f.fundName}</span>
              <span className="text-slate-500 whitespace-nowrap">{f.vintageYear}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span className="text-slate-500">Net Carry</span>
              <span className="text-right text-amber-600 font-semibold font-mono">{formatCurrency(f.netCarry, true)}</span>
              <span className="text-slate-500">Net After Tax</span>
              <span className="text-right text-emerald-600 font-semibold font-mono">{formatCurrency(f.netAfterTax, true)}</span>
              <span className="text-slate-500">Realization</span>
              <span className="text-right text-slate-600">{f.realizationQuarter} {f.realizationYear}</span>
              <span className="text-slate-500">Pipeline</span>
              <div className="flex items-center justify-end gap-1.5">
                <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.round(f.pipelineSharePct * 100)}%` }} />
                </div>
                <span className="text-slate-600">{Math.round(f.pipelineSharePct * 100)}%</span>
              </div>
            </div>
          </div>
        ))}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-semibold">
            <span className="text-slate-600">Total Net Carry</span>
            <span className="text-right text-amber-600 font-mono">{formatCurrency(totals.netCarry, true)}</span>
            <span className="text-slate-600">Total After Tax</span>
            <span className="text-right text-emerald-600 font-mono">{formatCurrency(totals.netAfterTax, true)}</span>
          </div>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200">
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
            <tr key={f.fundName} className={i % 2 === 0 ? "bg-slate-50" : ""}>
              <td className="py-1.5 pr-3 text-slate-700 font-medium max-w-[160px] truncate">{f.fundName}</td>
              <td className="py-1.5 pr-3 text-right text-slate-600">{f.vintageYear}</td>
              <td className="py-1.5 pr-3 text-right text-slate-500">{formatPct(f.carryPct)}</td>
              <td className="py-1.5 pr-3 text-right text-slate-500">{f.currentTvpi.toFixed(2)}×</td>
              <td className="py-1.5 pr-3 text-right text-slate-700 font-mono">{formatCurrency(f.expectedGrossCarry, true)}</td>
              <td className="py-1.5 pr-3 text-right text-slate-600">{formatPct(f.haircutPct)}</td>
              <td className="py-1.5 pr-3 text-right text-amber-600 font-semibold font-mono">{formatCurrency(f.netCarry, true)}</td>
              <td className="py-1.5 pr-3 text-right text-slate-500">
                {f.realizationQuarter} {f.realizationYear}
              </td>
              <td className="py-1.5 pr-3 text-right text-rose-600 font-mono">~{formatCurrency(f.estimatedTax, true)}</td>
              <td className="py-1.5 pr-3 text-right text-emerald-600 font-semibold font-mono">{formatCurrency(f.netAfterTax, true)}</td>
              <td className="py-1.5 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
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
          <tr className="border-t border-slate-200">
            <td colSpan={4} className="pt-2 text-xs text-slate-600 font-medium">Total</td>
            <td className="pt-2 text-right text-slate-700 font-mono font-semibold text-xs pr-3">
              {formatCurrency(funds.reduce((s, f) => s + f.expectedGrossCarry, 0), true)}
            </td>
            <td />
            <td className="pt-2 text-right text-amber-600 font-semibold font-mono text-xs pr-3">
              {formatCurrency(funds.reduce((s, f) => s + f.netCarry, 0), true)}
            </td>
            <td />
            <td className="pt-2 text-right text-rose-600 font-mono text-xs pr-3">
              ~{formatCurrency(funds.reduce((s, f) => s + f.estimatedTax, 0), true)}
            </td>
            <td className="pt-2 text-right text-emerald-600 font-semibold font-mono text-xs pr-3">
              {formatCurrency(funds.reduce((s, f) => s + f.netAfterTax, 0), true)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
      </div>
    </>
  );
}
