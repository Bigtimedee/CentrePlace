"use client";

import { useState } from "react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import {
  Shield,
  Gift,
  Landmark,
  Building2,
  FileCheck,
  Heart,
  Zap,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from "lucide-react";
import type {
  EstateRecommendation,
  RecommendationCategory,
  RecommendationPriority,
} from "@/server/simulation/estate/recommendations";
import { LegislationAlertBadge } from "@/components/legislation/legislation-alert-badge";

interface Props {
  recommendations: EstateRecommendation[];
}

// ── Category metadata ──────────────────────────────────────────────────────────

const CATEGORY_META: Record<
  RecommendationCategory,
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  insurance:        { icon: Shield,    color: "text-amber-600" },
  gifting:          { icon: Gift,      color: "text-emerald-600" },
  trust:            { icon: Landmark,  color: "text-violet-600" },
  real_estate:      { icon: Building2, color: "text-sky-600" },
  portability:      { icon: FileCheck, color: "text-[#C8A45A]" },
  charitable:       { icon: Heart,     color: "text-rose-600" },
  opportunity_zone: { icon: Zap,       color: "text-yellow-600" },
};

const PRIORITY_BADGE: Record<
  RecommendationPriority,
  { label: string; classes: string }
> = {
  high:   { label: "High Priority", classes: "bg-rose-50 text-rose-600 border-rose-200" },
  medium: { label: "Review Soon",   classes: "bg-amber-50 text-amber-600 border-amber-200" },
  low:    { label: "Consider",      classes: "bg-slate-50 text-slate-500 border-slate-200" },
};

// ── Recommendation row ─────────────────────────────────────────────────────────

function RecommendationRow({ rec }: { rec: EstateRecommendation }) {
  const [expanded, setExpanded] = useState(false);
  const meta = CATEGORY_META[rec.category];
  const Icon = meta.icon;
  const badge = PRIORITY_BADGE[rec.priority];

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Collapsed header — always visible */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start gap-3 px-4 py-4 text-left hover:bg-slate-100 transition-colors cursor-pointer"
      >
        <div className={`mt-0.5 flex-shrink-0 ${meta.color}`}>
          <Icon className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-900">{rec.title}</span>
            <span className={`text-xs font-medium border rounded-full px-2 py-0.5 ${badge.classes}`}>
              {badge.label}
            </span>
            {rec.estimatedTaxSavings > 0 && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                Save ~{formatCurrency(rec.estimatedTaxSavings, true)}
              </span>
            )}
            {rec.category === "opportunity_zone" && <LegislationAlertBadge />}
          </div>
          {!expanded && (
            <p className="text-xs text-slate-600 mt-1 line-clamp-2">{rec.description}</p>
          )}
        </div>

        <div className="flex-shrink-0 text-slate-600 mt-0.5">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-700 mt-3 leading-relaxed">{rec.description}</p>

          {rec.supportingFigures && rec.supportingFigures.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
              {rec.supportingFigures.map(fig => (
                <div key={fig.label} className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-600">{fig.label}</p>
                  <p className="text-sm font-semibold font-mono text-slate-700 mt-0.5">{fig.value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-[#FFF3D8] border border-[#D4B896]">
            <ArrowRight className="h-3.5 w-3.5 text-[#C8A45A] mt-0.5 flex-shrink-0" />
            <p className="text-xs text-[#1A0F28] leading-relaxed">{rec.actionRequired}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main card ──────────────────────────────────────────────────────────────────

export function EstateOptimizationsCard({ recommendations }: Props) {
  const totalSavings = recommendations.reduce((s, r) => s + r.estimatedTaxSavings, 0);
  const highCount = recommendations.filter(r => r.priority === "high").length;

  return (
    <Card>
      <CardHeader
        title="Estate Optimization Recommendations"
        description={`${recommendations.length} strateg${recommendations.length === 1 ? "y" : "ies"} identified${
          totalSavings > 0
            ? ` · up to ${formatCurrency(totalSavings, true)} in potential tax savings`
            : ""
        }`}
        action={
          highCount > 0 ? (
            <span className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-full px-3 py-1">
              {highCount} High Priority
            </span>
          ) : (
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
              No Urgent Actions
            </span>
          )
        }
      />
      <CardBody>
        {recommendations.length === 0 ? (
          <p className="text-sm text-slate-600 text-center py-4">
            No optimization recommendations at this time. Your estate appears well-structured.
          </p>
        ) : (
          <div className="space-y-3">
            {recommendations.map(rec => (
              <RecommendationRow key={rec.id} rec={rec} />
            ))}
          </div>
        )}

        <p className="mt-5 text-xs text-slate-600 leading-relaxed">
          Savings estimates are illustrative based on 2026 federal estate tax rates and current estate values.
          Consult a qualified estate planning attorney and CPA before implementing any strategy.
          Estate tax law is subject to change by Congress.
        </p>
      </CardBody>
    </Card>
  );
}
