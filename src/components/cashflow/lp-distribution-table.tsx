"use client";

import { formatCurrency } from "@/lib/utils";
import type { LPFundSummary } from "@/server/simulation/cashflow/types";

interface Props {
  funds: LPFundSummary[];
}

export function LPDistributionTable({ funds }: Props) {
  if (funds.length === 0) {
    return (
      <p className="text-sm text-slate-600 text-center py-4">
        No LP investments. Add LP investments to see your distribution schedule.
      </p>
    );
  }

  const sorted = [...funds].sort((a, b) => {
    if (a.firstDistributionYear == null) return 1;
    if (b.firstDistributionYear == null) return -1;
    return a.firstDistributionYear - b.firstDistributionYear;
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left text-slate-600 font-medium pb-2 pr-3">Fund</th>
            <th className="text-right text-slate-600 font-medium pb-2 pr-3">Vintage</th>
            <th className="text-right text-slate-600 font-medium pb-2 pr-3">Commitment</th>
            <th className="text-right text-slate-600 font-medium pb-2 pr-3">Current NAV</th>
            <th className="text-right text-slate-600 font-medium pb-2 pr-3">Total Dist.</th>
            <th className="text-right text-slate-600 font-medium pb-2 pr-3">First</th>
            <th className="text-right text-slate-600 font-medium pb-2 pr-3">Last</th>
            <th className="text-right text-slate-600 font-medium pb-2">Events</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((f, i) => (
            <tr key={f.fundName} className={i % 2 === 0 ? "bg-slate-50" : ""}>
              <td className="py-1.5 pr-3 text-slate-700 font-medium max-w-[160px] truncate">{f.fundName}</td>
              <td className="py-1.5 pr-3 text-right text-slate-600">{f.vintageYear}</td>
              <td className="py-1.5 pr-3 text-right text-slate-500 font-mono">{formatCurrency(f.commitmentAmount, true)}</td>
              <td className="py-1.5 pr-3 text-right text-slate-700 font-mono">{formatCurrency(f.currentNav, true)}</td>
              <td className="py-1.5 pr-3 text-right text-indigo-600 font-semibold font-mono">
                {formatCurrency(f.totalExpectedDistributions, true)}
              </td>
              <td className="py-1.5 pr-3 text-right text-slate-500">
                {f.firstDistributionYear ?? "—"}
              </td>
              <td className="py-1.5 pr-3 text-right text-slate-500">
                {f.lastDistributionYear ?? "—"}
              </td>
              <td className="py-1.5 text-right text-slate-600">
                {f.distributionCount > 0 ? `${f.distributionCount} event${f.distributionCount !== 1 ? "s" : ""}` : "None"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200">
            <td colSpan={4} className="pt-2 text-xs text-slate-600 font-medium">Total</td>
            <td className="pt-2 text-right text-indigo-600 font-semibold font-mono text-xs pr-3">
              {formatCurrency(funds.reduce((s, f) => s + f.totalExpectedDistributions, 0), true)}
            </td>
            <td colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
