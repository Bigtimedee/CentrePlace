"use client";

import type { ActionItem, ActionCategory } from "@/server/simulation/plan/types";

const ALL_CATEGORIES: Array<{ value: ActionCategory; label: string }> = [
  { value: "tax_optimization", label: "Tax" },
  { value: "carry_timing", label: "Carry" },
  { value: "estate_planning", label: "Estate" },
  { value: "insurance_review", label: "Insurance" },
  { value: "lp_distribution", label: "LP" },
  { value: "fi_acceleration", label: "FI" },
  { value: "liquidity_planning", label: "Liquidity" },
];

interface ActionPlanFiltersProps {
  items: ActionItem[];
  active: ActionCategory | "all";
  onChange: (cat: ActionCategory | "all") => void;
}

export function ActionPlanFilters({ items, active, onChange }: ActionPlanFiltersProps) {
  // Only show categories that have at least one item
  const presentCategories = ALL_CATEGORIES.filter(c =>
    items.some(i => i.category === c.value),
  );

  if (presentCategories.length <= 1) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onChange("all")}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
          active === "all"
            ? "bg-[#C8A45A] text-[#1A0F28]"
            : "bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200"
        }`}
      >
        All ({items.length})
      </button>

      {presentCategories.map(({ value, label }) => {
        const count = items.filter(i => i.category === value).length;
        const isActive = active === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
              isActive
                ? "bg-[#C8A45A] text-[#1A0F28]"
                : "bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200"
            }`}
          >
            {label} ({count})
          </button>
        );
      })}
    </div>
  );
}
