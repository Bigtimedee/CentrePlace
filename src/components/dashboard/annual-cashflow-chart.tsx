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
import type { QuarterResult } from "@/server/simulation/engine/types";

// ── Data preparation ──────────────────────────────────────────────────────────

/** Aggregate Q4 annual cash-flow totals (sum all 4 quarters). */
function toAnnualCashflows(quarters: QuarterResult[]) {
  const byYear = new Map<number, {
    year: number;
    income: number;
    spending: number;
    taxes: number;
    net: number;
  }>();

  for (const q of quarters) {
    if (!byYear.has(q.year)) {
      byYear.set(q.year, { year: q.year, income: 0, spending: 0, taxes: 0, net: 0 });
    }
    const row = byYear.get(q.year)!;
    const grossIncome = q.w2Income + q.carryIncome + q.lpIncome + q.rentalNetIncome;
    const grossSpending = q.recurringSpending + q.oneTimeSpending + q.mortgagePayments + q.insurancePremiums;
    row.income += grossIncome;
    row.spending += grossSpending;
    row.taxes += q.taxPayment;
    row.net += q.netCashFlow;
  }

  return Array.from(byYear.values()).map(r => ({
    year: r.year,
    Income: Math.round(r.income),
    Spending: Math.round(r.spending),
    Taxes: Math.round(r.taxes),
    "Net Flow": Math.round(r.net),
  }));
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtK(value: number) {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; fill?: string }>;
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs shadow-xl min-w-[160px]">
      <p className="text-slate-600 mb-2 font-medium">Year {label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4 mb-1">
          <span style={{ color: entry.fill ?? entry.color }}>{entry.name}</span>
          <span className="text-slate-900 font-semibold">{fmtK(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  quarters: QuarterResult[];
}

export function AnnualCashflowChart({ quarters }: Props) {
  const data = toAnnualCashflows(quarters);

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Annual Cash Flow</h3>
        <p className="text-xs text-slate-600 mt-0.5">Income, spending, and taxes by year</p>
      </div>

      <div className="h-[160px] sm:h-[220px] lg:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval={4}
          />
          <YAxis
            tickFormatter={fmtK}
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
          <ReferenceLine y={0} stroke="#334155" strokeWidth={1} />

          <Bar dataKey="Income"   stackId="in"  fill="#10b981" radius={[0,0,0,0]} maxBarSize={24} />
          <Bar dataKey="Spending" stackId="out" fill="#f43f5e" radius={[0,0,0,0]} maxBarSize={24} />
          <Bar dataKey="Taxes"    stackId="out" fill="#f97316" radius={[2,2,0,0]} maxBarSize={24} />

          <Line
            type="monotone"
            dataKey="Net Flow"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, fill: "#6366f1" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
