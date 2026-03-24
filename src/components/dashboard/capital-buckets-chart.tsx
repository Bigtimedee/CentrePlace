"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { QuarterResult } from "@/server/simulation/engine/types";

// ── Data preparation ──────────────────────────────────────────────────────────

function toAnnualRows(quarters: QuarterResult[]) {
  return quarters
    .filter(q => q.quarterLabel === "Q4")
    .map(q => ({
      year: q.year,
      "Investment Accounts": Math.round(q.investmentCapital),
      "Real Estate Equity": Math.round(q.realEstateEquity),
      "Insurance Cash Value": Math.round(q.insuranceCashValue),
      "Unrealized Carry": Math.round(q.unrealizedCarry),
    }));
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtM(value: number) {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, e) => s + e.value, 0);
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs shadow-xl min-w-[180px]">
      <p className="text-slate-600 mb-2 font-medium">Year {label}</p>
      {[...payload].reverse().map((entry) => entry.value > 0 && (
        <div key={entry.name} className="flex items-center justify-between gap-4 mb-1">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="text-slate-900 font-semibold">{fmtM(entry.value)}</span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-4 pt-1.5 mt-1.5 border-t border-slate-200">
        <span className="text-slate-600">Total</span>
        <span className="text-slate-900 font-semibold">{fmtM(total)}</span>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  quarters: QuarterResult[];
}

export function CapitalBucketsChart({ quarters }: Props) {
  const data = toAnnualRows(quarters);

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Capital Composition</h3>
        <p className="text-xs text-slate-600 mt-0.5">How your capital is allocated across asset buckets</p>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 16 }}>
          <defs>
            {[
              { id: "inv",   color: "#6366f1" },
              { id: "re",    color: "#10b981" },
              { id: "ins",   color: "#a78bfa" },
              { id: "carry", color: "#f59e0b" },
            ].map(({ id, color }) => (
              <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.6} />
                <stop offset="95%" stopColor={color} stopOpacity={0.1} />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval={4}
          />
          <YAxis
            tickFormatter={fmtM}
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "#94a3b8", paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />

          <Area
            type="monotone"
            dataKey="Unrealized Carry"
            stackId="1"
            stroke="#f59e0b"
            fill="url(#carry)"
            strokeWidth={1}
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="Insurance Cash Value"
            stackId="1"
            stroke="#a78bfa"
            fill="url(#ins)"
            strokeWidth={1}
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="Real Estate Equity"
            stackId="1"
            stroke="#10b981"
            fill="url(#re)"
            strokeWidth={1}
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="Investment Accounts"
            stackId="1"
            stroke="#6366f1"
            fill="url(#inv)"
            strokeWidth={1}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
