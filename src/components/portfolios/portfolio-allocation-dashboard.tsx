"use client";

import { trpc } from "@/lib/trpc";
import { HoldingsBreakdownChart } from "./holdings-breakdown-chart";

const ASSET_CLASS_COLORS: Record<string, string> = {
  equity: "bg-[#FFF3D8] text-[#C8A45A]",
  bond: "bg-green-100 text-green-800",
  alt: "bg-purple-100 text-purple-800",
  cash: "bg-gray-100 text-gray-700",
};

const ASSET_CLASS_LABELS: Record<string, string> = {
  equity: "Equity",
  bond: "Bonds",
  alt: "Alternatives",
  cash: "Cash",
};

export function PortfolioAllocationDashboard() {
  const { data: holdings, isLoading } = trpc.portfolios.listAllHoldings.useQuery();

  if (isLoading) {
    return <div className="text-sm text-gray-400 animate-pulse">Loading portfolio data…</div>;
  }

  if (!holdings || holdings.length === 0) {
    return null;
  }

  const totalValue = holdings.reduce((s, h) => s + h.marketValue, 0);

  const byClass: Record<string, number> = {};
  for (const h of holdings) {
    byClass[h.assetClass] = (byClass[h.assetClass] ?? 0) + h.marketValue;
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-slate-50 px-6 py-5">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Current Allocation Breakdown</h2>
        <span className="text-xs text-gray-400">
          · {holdings.length} holdings ·{" "}
          <span className="font-medium text-gray-600">
            ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} total
          </span>
        </span>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 min-w-0">
          <HoldingsBreakdownChart holdings={holdings} />
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          {Object.entries(byClass)
            .sort((a, b) => b[1] - a[1])
            .map(([assetClass, value]) => {
              const pct = totalValue > 0 ? (value / totalValue) * 100 : 0;
              return (
                <div key={assetClass}>
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${ASSET_CLASS_COLORS[assetClass] ?? "bg-gray-100"}`}
                    >
                      {ASSET_CLASS_LABELS[assetClass] ?? assetClass}
                    </span>
                    <span className="text-sm font-medium text-gray-700">
                      ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}{" "}
                      <span className="text-gray-400 font-normal">({pct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        assetClass === "equity" ? "bg-[#C8A45A]"
                        : assetClass === "bond" ? "bg-green-400"
                        : assetClass === "alt" ? "bg-purple-400"
                        : "bg-gray-300"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
