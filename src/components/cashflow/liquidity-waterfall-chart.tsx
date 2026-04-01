"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import type { CashEventSource, QuarterlyLiquidityBucket } from "@/server/simulation/cashflow/types";
import { EmptyState } from "@/components/ui/empty-state";
import { SOURCE_CONFIG } from "./cashflow-filter-bar";

function fmtK(value: number) {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

interface TooltipPayloadEntry {
  name: string;
  value: number;
  fill?: string;
  color?: string;
  payload?: { _events?: Array<{ label: string; grossAmount: number; estimatedTax: number; netAmount: number; source: CashEventSource }> };
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  const events = payload[0]?.payload?._events ?? [];
  const hasMeaningfulEvent = events.some(e => e.source !== "w2" && e.source !== "rental");

  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs shadow-xl min-w-[200px] max-w-[280px]">
      <p className="text-slate-600 mb-2 font-medium">{label}</p>
      {payload
        .filter(e => e.name !== "Cumulative" && Math.abs(e.value) > 0)
        .map(entry => (
          <div key={entry.name} className="flex items-center justify-between gap-4 mb-1">
            <span style={{ color: entry.fill ?? entry.color }}>{entry.name}</span>
            <span className="text-slate-900 font-semibold">{fmtK(entry.value)}</span>
          </div>
        ))}
      {hasMeaningfulEvent && (
        <>
          <div className="border-t border-slate-200 mt-2 pt-2 space-y-1">
            {events
              .filter(e => e.source !== "w2" && e.source !== "rental")
              .map((e, i) => (
                <div key={i} className="text-slate-600">
                  <span style={{ color: SOURCE_CONFIG[e.source].color }}>{e.label}</span>
                  <span className="ml-1 text-slate-600">
                    {formatCurrency(e.grossAmount, true)} gross · ~{formatCurrency(e.estimatedTax, true)} tax
                  </span>
                </div>
              ))}
          </div>
        </>
      )}
      <div className="border-t border-slate-200 mt-2 pt-2">
        {payload
          .filter(e => e.name === "Cumulative" && e.value !== 0)
          .map(entry => (
            <div key="cumulative" className="flex items-center justify-between gap-4">
              <span className="text-slate-600">Running Total</span>
              <span className="text-slate-700 font-semibold">{fmtK(entry.value)}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

interface Props {
  quarters: QuarterlyLiquidityBucket[];
  activeSources: Set<CashEventSource>;
  viewMode: "annual" | "quarterly";
}

export function LiquidityWaterfallChart({ quarters, activeSources, viewMode }: Props) {
  // Annual mode: use Q4 buckets (which have the W-2/rental annual summaries)
  // Quarterly mode: use all quarters that have any data
  const filteredBuckets = viewMode === "annual"
    ? quarters.filter(q => q.quarter === "Q4")
    : quarters.filter(q => q.totalNet > 0 || quarters.indexOf(q) % 4 === 3);

  const data = filteredBuckets.map(q => ({
    label: viewMode === "annual" ? String(q.year) : q.periodKey,
    "GP Carry": activeSources.has("carry") ? Math.round(q.carryNet) : 0,
    "LP Dist.": activeSources.has("lp_distribution") ? Math.round(q.lpNet) : 0,
    "RE Sale":  activeSources.has("real_estate_sale") ? Math.round(q.realEstateSaleNet) : 0,
    "W-2":      activeSources.has("w2") ? Math.round(q.w2Net) : 0,
    "Rental":   activeSources.has("rental") ? Math.round(q.rentalNet) : 0,
    "Cumulative": Math.round(q.cumulativeNet),
    _events: q.events,
  }));

  if (data.length === 0) {
    return <EmptyState message="Run the simulation to see liquidity events." />;
  }

  const maxCumulative = Math.max(...data.map(d => d["Cumulative"]), 1);

  return (
    <div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 4, right: 52, bottom: 0, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval={viewMode === "annual" ? 4 : "preserveStartEnd"}
          />
          <YAxis
            yAxisId="cash"
            tickFormatter={fmtK}
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <YAxis
            yAxisId="cumulative"
            orientation="right"
            tickFormatter={fmtK}
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={52}
            domain={[0, maxCumulative * 1.1]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "#94a3b8", paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />
          <ReferenceLine yAxisId="cash" y={0} stroke="#334155" strokeWidth={1} />

          <Bar yAxisId="cash" dataKey="GP Carry" stackId="in" fill={SOURCE_CONFIG.carry.color} maxBarSize={22} />
          <Bar yAxisId="cash" dataKey="LP Dist." stackId="in" fill={SOURCE_CONFIG.lp_distribution.color} maxBarSize={22} />
          <Bar yAxisId="cash" dataKey="RE Sale"  stackId="in" fill={SOURCE_CONFIG.real_estate_sale.color} maxBarSize={22} />
          <Bar yAxisId="cash" dataKey="W-2"      stackId="in" fill={SOURCE_CONFIG.w2.color} maxBarSize={22} />
          <Bar yAxisId="cash" dataKey="Rental"   stackId="in" fill={SOURCE_CONFIG.rental.color} radius={[2, 2, 0, 0]} maxBarSize={22} />

          <Line
            yAxisId="cumulative"
            type="monotone"
            dataKey="Cumulative"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, fill: "#6366f1" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
