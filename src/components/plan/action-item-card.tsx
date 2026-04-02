"use client";

import Link from "next/link";
import type { ActionItem, ActionUrgency, ActionCategory } from "@/server/simulation/plan/types";

// ── Urgency styling ────────────────────────────────────────────────────────────

const URGENCY_CONFIG: Record<ActionUrgency, { badge: string; border: string; dot: string }> = {
  do_this_year: {
    badge: "bg-rose-500/15 text-rose-600 border border-rose-500/30",
    border: "border-l-rose-500",
    dot: "bg-rose-500",
  },
  plan_now: {
    badge: "bg-amber-500/15 text-amber-600 border border-amber-500/30",
    border: "border-l-amber-500",
    dot: "bg-amber-500",
  },
  monitor: {
    badge: "bg-slate-100 text-slate-500 border border-slate-200",
    border: "border-l-slate-300",
    dot: "bg-slate-400",
  },
};

const URGENCY_LABEL: Record<ActionUrgency, string> = {
  do_this_year: "Do This Year",
  plan_now: "Plan Now",
  monitor: "Monitor",
};

// ── Category labels ────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<ActionCategory, string> = {
  tax_optimization: "Tax",
  carry_timing: "Carry",
  estate_planning: "Estate",
  insurance_review: "Insurance",
  lp_distribution: "LP",
  fi_acceleration: "FI",
  liquidity_planning: "Liquidity",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatImpact(n: number): string {
  if (n <= 0) return "";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toFixed(0)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ActionItemCardProps {
  item: ActionItem;
  expanded?: boolean;
  onToggle?: () => void;
}

export function ActionItemCard({ item, expanded = false, onToggle }: ActionItemCardProps) {
  const uc = URGENCY_CONFIG[item.urgency];
  const impactStr = formatImpact(item.dollarImpact);

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white border-l-4 ${uc.border} transition-colors hover:border-slate-300`}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-5 py-4 flex items-start gap-4 cursor-pointer"
      >
        {/* Dot */}
        <div className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${uc.dot}`} />

        {/* Title + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${uc.badge}`}>
              {URGENCY_LABEL[item.urgency]}
            </span>
            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500 border border-slate-200">
              {CATEGORY_LABEL[item.category]}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-900 leading-snug">{item.title}</p>
        </div>

        {/* Dollar impact */}
        {impactStr && (
          <div className="flex-shrink-0 text-right">
            <p className="text-base font-bold text-slate-900 tabular-nums">{impactStr}</p>
            {item.dollarImpactLabel && (
              <p className="text-xs text-slate-600 leading-tight">{item.dollarImpactLabel}</p>
            )}
          </div>
        )}

        {/* Chevron */}
        <svg
          className={`flex-shrink-0 mt-0.5 h-4 w-4 text-slate-600 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-5 pt-0 ml-6 border-t border-slate-200">
          {/* Rationale */}
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Why this matters</p>
            <p className="text-sm text-slate-600 leading-relaxed">{item.rationale}</p>
          </div>

          {/* Action */}
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Next step</p>
            <p className="text-sm text-slate-700 leading-relaxed">{item.action}</p>
          </div>

          {/* Supporting figures */}
          {item.supportingFigures && item.supportingFigures.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {item.supportingFigures.map(f => (
                <div
                  key={f.label}
                  className="rounded-lg bg-slate-100 border border-slate-200 px-3 py-2 text-center min-w-[80px]"
                >
                  <p className="text-xs text-slate-600">{f.label}</p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5 tabular-nums">{f.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Deep link */}
          <div className="mt-4">
            <Link
              href={item.deepLinkHref}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#C8A45A] hover:text-amber-400 transition-colors"
            >
              {item.deepLinkLabel}
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
