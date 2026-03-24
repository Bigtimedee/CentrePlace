"use client";

import type { CashEventSource } from "@/server/simulation/cashflow/types";

export const SOURCE_CONFIG: Record<CashEventSource, { label: string; color: string; activeClass: string }> = {
  carry:           { label: "GP Carry",    color: "#f59e0b", activeClass: "bg-amber-950/60 border-amber-600 text-amber-300" },
  lp_distribution: { label: "LP Dist.",    color: "#6366f1", activeClass: "bg-indigo-950/60 border-indigo-600 text-indigo-300" },
  real_estate_sale:{ label: "RE Sale",     color: "#10b981", activeClass: "bg-emerald-950/60 border-emerald-600 text-emerald-300" },
  w2:              { label: "W-2 Income",  color: "#64748b", activeClass: "bg-slate-700/60 border-slate-500 text-slate-300" },
  rental:          { label: "Rental",      color: "#a78bfa", activeClass: "bg-violet-950/60 border-violet-600 text-violet-300" },
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
                  : "bg-slate-900 border-slate-700 text-slate-600 hover:border-slate-600 hover:text-slate-400"
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
        className="text-xs font-medium border rounded-full px-3 py-1 transition-colors bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300"
      >
        View: {viewMode === "annual" ? "Annual" : "Quarterly"}
      </button>
    </div>
  );
}
