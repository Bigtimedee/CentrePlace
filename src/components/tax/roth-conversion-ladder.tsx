"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { formatPct } from "@/lib/utils";
import type { AnnualTaxProjection } from "@/server/simulation/tax/projection-types";

function fmtK(value: number) {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function bracketColor(marginalRate: number): string {
  if (marginalRate <= 0.15) return "#10b981"; // emerald — high-value opportunity
  if (marginalRate <= 0.25) return "#f59e0b"; // amber — moderate
  return "#f43f5e";                            // rose — expensive
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { marginalOrdinaryRate: number; estimatedRothTaxCost: number } }>;
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs shadow-xl min-w-[180px]">
      <p className="text-slate-500 mb-2 font-medium">Year {label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-slate-600">Conversion Room</span>
          <span className="text-slate-900 font-semibold">{fmtK(d.value)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-600">Marginal Rate</span>
          <span className="text-slate-900 font-semibold">{formatPct(d.payload.marginalOrdinaryRate)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-600">Est. Tax Cost</span>
          <span className="text-slate-900 font-semibold">{fmtK(d.payload.estimatedRothTaxCost)}</span>
        </div>
      </div>
    </div>
  );
}

interface Props {
  projections: AnnualTaxProjection[];
}

export function RothConversionLadder({ projections }: Props) {
  // First 15 years, only years with positive conversion capacity
  const data = projections
    .slice(0, 15)
    .map(p => ({
      year: p.year,
      capacity: Math.round(p.rothConversionCapacity),
      marginalOrdinaryRate: p.marginalOrdinaryRate,
      estimatedRothTaxCost: Math.round(p.estimatedRothTaxCost),
    }));

  const highValueYears = data.filter(d => d.marginalOrdinaryRate <= 0.15 && d.capacity > 0).length;

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Roth Conversion Ladder</h3>
          <p className="text-xs text-slate-600 mt-0.5">
            Available headroom before hitting the 25% ordinary bracket — first 15 years
          </p>
        </div>
        {highValueYears > 0 && (
          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 flex-shrink-0">
            {highValueYears} low-rate year{highValueYears !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="h-[140px] sm:h-[180px] lg:h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={fmtK}
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="capacity" radius={[3, 3, 0, 0]} maxBarSize={28}>
            {data.map((entry) => (
              <Cell key={entry.year} fill={bracketColor(entry.marginalOrdinaryRate)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
          10–15% bracket (convert now)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
          25% bracket
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
          28%+ bracket
        </span>
      </div>
    </div>
  );
}
