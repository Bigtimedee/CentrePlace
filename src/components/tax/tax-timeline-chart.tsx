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
import type { AnnualTaxProjection } from "@/server/simulation/tax/projection-types";
import { EmptyState } from "@/components/ui/empty-state";

function fmtK(value: number) {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function fmtPct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; fill?: string }>;
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs shadow-xl min-w-[190px]">
      <p className="text-slate-500 mb-2 font-medium">Year {label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4 mb-1">
          <span style={{ color: entry.fill ?? entry.color }}>{entry.name}</span>
          <span className="text-slate-900 font-semibold">
            {entry.name === "Eff. Rate" ? fmtPct(entry.value / 100) : fmtK(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

interface Props {
  projections: AnnualTaxProjection[];
}

export function TaxTimelineChart({ projections }: Props) {
  if (projections.length === 0) {
    return <EmptyState message="Run the simulation to see the tax timeline." />;
  }

  const data = projections.map(p => ({
    year: p.year,
    "Fed Ordinary": Math.round(p.federalOrdinaryTax),
    "Fed LTCG":     Math.round(p.federalLtcgTax),
    "NIIT":         Math.round(p.federalNiit),
    "State":        Math.round(p.stateIncomeTax),
    "Eff. Rate":    +(p.effectiveTotalRate * 100).toFixed(2),
    hasCarry:       p.carryEvents.length > 0,
  }));

  // Carry realization years for reference lines
  const carryYears = new Set(
    projections.filter(p => p.carryEvents.length > 0).map(p => p.year),
  );

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Projected Annual Tax Liability</h3>
        <p className="text-xs text-slate-600 mt-0.5">
          Federal + state tax by component across the 40-year window · amber dashes = carry realization years
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 4, right: 48, bottom: 0, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval={4}
          />
          <YAxis
            yAxisId="tax"
            tickFormatter={fmtK}
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <YAxis
            yAxisId="rate"
            orientation="right"
            tickFormatter={v => `${v.toFixed(0)}%`}
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
            domain={[0, 50]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "#94a3b8", paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />

          {/* Carry realization reference lines */}
          {Array.from(carryYears).map(yr => (
            <ReferenceLine
              key={yr}
              yAxisId="tax"
              x={yr}
              stroke="#f59e0b"
              strokeDasharray="3 3"
              strokeOpacity={0.4}
            />
          ))}

          <Bar yAxisId="tax" dataKey="Fed Ordinary" stackId="tax" fill="#6366f1" maxBarSize={20} />
          <Bar yAxisId="tax" dataKey="Fed LTCG"     stackId="tax" fill="#f59e0b" maxBarSize={20} />
          <Bar yAxisId="tax" dataKey="NIIT"         stackId="tax" fill="#f43f5e" maxBarSize={20} />
          <Bar yAxisId="tax" dataKey="State"        stackId="tax" fill="#10b981" radius={[2, 2, 0, 0]} maxBarSize={20} />

          <Line
            yAxisId="rate"
            type="monotone"
            dataKey="Eff. Rate"
            stroke="#94a3b8"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 2"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
