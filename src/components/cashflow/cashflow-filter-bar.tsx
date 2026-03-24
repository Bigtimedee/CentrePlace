"use client";

import type { CashEventSource } from "@/server/simulation/cashflow/types";

export const SOURCE_CONFIG: Record<CashEventSource, { label: string; color: string; activeClass: string }> = {
  carry:           { label: "GP Carry",    color: "#f59e0b", activeClass: "bg-amber-50 border-amber-400 text-amber-700" },
  lp_distribution: { label: "LP Dist.",    color: "#6366f1", activeClass: "bg-indigo-50 border-indigo-400 text-indigo-700" },
  real_estate_sale:{ label: "RE Sale",     color: "#10b981", activeClass: "bg-emerald-50 border-emerald-400 text-emerald-700" },
  w2:              { label: "W-2 Income",  color: "#64748b", activeClass: "bg-slate-100 border-slate-400 text-slate-700" },
  rental:          { label: "Rental",      color: "#a78bfa", activeClass: "bg-violet-50 border-violet-400 text-violet-700" },
};

const SOURCES: CashEventSource[] = ["carry", "lp_distribution", "real_estate_sale", "w2", "rental"];

interface Props {
  activeSources: Set<CashEventSource>;
  onToggle: (source: CashEventSource) => void;
  viewMode: "annual" | "quarterly";
  onToggleViewMode: () => void;
}

export function CashflowFilterBar({ activeSources, onToggle, viewMode, onToggleViewMode }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-600 font-medium">Show:</span>
        {SOURCES.map(src => {
          const config = SOURCE_CONFIG[src];
          const isActive = activeSources.has(src);
          return (
            <button
              key={src}
              onClick={() => onToggle(src)}
              className={`text-xs font-medium border rounded-full px-3 py-1 transition-colors ${
                isActive
                  ? config.activeClass
                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-600"
              }`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                style={{ backgroundColor: isActive ? config.color : "#475569" }}
              />
              {config.label}
            </button>
          );
        })}
      </div>

      <button
        onClick={onToggleViewMode}
        className="text-xs font-medium border rounded-full px-3 py-1 transition-colors bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-600"
      >
        View: {viewMode === "annual" ? "Annual" : "Quarterly"}
      </button>
    </div>
  );
}
