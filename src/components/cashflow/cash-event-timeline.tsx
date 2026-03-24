"use client";

import { formatCurrency } from "@/lib/utils";
import type { CashEventSource, QuarterlyLiquidityBucket } from "@/server/simulation/cashflow/types";
import { SOURCE_CONFIG } from "./cashflow-filter-bar";

function dominantSource(bucket: QuarterlyLiquidityBucket): CashEventSource {
  const candidates: [CashEventSource, number][] = [
    ["carry", bucket.carryNet],
    ["lp_distribution", bucket.lpNet],
    ["real_estate_sale", bucket.realEstateSaleNet],
  ];
  return candidates.reduce((a, b) => b[1] > a[1] ? b : a)[0];
}

interface Props {
  significantQuarters: QuarterlyLiquidityBucket[];
  activeSources: Set<CashEventSource>;
}

export function CashEventTimeline({ significantQuarters, activeSources }: Props) {
  const visible = significantQuarters.filter(q => {
    if (activeSources.has("carry") && q.carryNet > 0) return true;
    if (activeSources.has("lp_distribution") && q.lpNet > 0) return true;
    if (activeSources.has("real_estate_sale") && q.realEstateSaleNet > 0) return true;
    return false;
  });

  if (visible.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-slate-600 text-xs text-center">
        No major cash events in the selected sources. Add carry, LP investments, or real estate sale projections.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3" style={{ minWidth: `${visible.length * 172}px` }}>
        {visible.map(bucket => {
          const src = dominantSource(bucket);
          const config = SOURCE_CONFIG[src];
          const totalNet = bucket.carryNet + bucket.lpNet + bucket.realEstateSaleNet;
          const totalTax = bucket.events
            .filter(e => e.source !== "w2" && e.source !== "rental")
            .reduce((s, e) => s + e.estimatedTax, 0);

          // Get named events (non-W2/rental)
          const namedEvents = bucket.events.filter(e => e.source !== "w2" && e.source !== "rental");

          return (
            <div
              key={bucket.periodKey}
              className="min-w-[160px] rounded-lg border p-3 flex-shrink-0"
              style={{
                borderColor: `${config.color}40`,
                backgroundColor: `${config.color}08`,
              }}
            >
              <div className="text-xs font-semibold mb-1" style={{ color: config.color }}>
                {bucket.quarter} {bucket.year}
              </div>
              <div className="text-sm font-bold text-slate-900">
                {formatCurrency(totalNet, true)}
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                ~{formatCurrency(totalTax, true)} est. tax
              </div>
              <div className="mt-2 space-y-0.5">
                {namedEvents.slice(0, 3).map((e, i) => (
                  <div key={i} className="text-xs text-slate-600 truncate">
                    <span style={{ color: SOURCE_CONFIG[e.source].color }}>
                      {SOURCE_CONFIG[e.source].label}
                    </span>
                    {" "}
                    <span className="text-slate-600">{e.label}</span>
                  </div>
                ))}
                {namedEvents.length > 3 && (
                  <div className="text-xs text-slate-600">+{namedEvents.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
