"use client";

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { QuarterResult, SimulationResult } from "@/server/simulation/engine/types";

// ── Data preparation ──────────────────────────────────────────────────────────

/** Sample Q4 of each year (40 annual snapshots) for a cleaner chart. */
function toAnnualRows(quarters: QuarterResult[]) {
  return quarters
    .filter(q => q.quarterLabel === "Q4")
    .map(q => ({
      year: q.year,
      age: q.age,
      totalCapital: q.totalCapital,
      requiredCapital: q.requiredCapital,
      isFI: q.isFI,
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
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs shadow-xl min-w-[160px]">
      <p className="text-slate-600 mb-2 font-medium">Year {label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4 mb-1">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="text-slate-900 font-semibold">{fmtM(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  result: SimulationResult;
}

export function CapitalProjectionChart({ result }: Props) {
  const data = toAnnualRows(result.quarters);
  const fiYear = result.fiDate?.year ?? null;

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Capital Projection</h3>
          <p className="text-xs text-slate-600 mt-0.5">Total capital vs required to reach FI</p>
        </div>
        {fiYear && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 self-start sm:self-auto">
            FI: {result.fiDate?.quarter} {fiYear} · Age {result.fiAge}
          </div>
        )}
      </div>

      <div className="h-[200px] sm:h-[280px] lg:h-[340px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="capGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
            </linearGradient>
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
            wrapperStyle={{ fontSize: 11, color: "#94a3b8", paddingTop: 12 }}
            iconType="circle"
            iconSize={8}
          />

          {/* FI date reference line */}
          {fiYear && (
            <ReferenceLine
              x={fiYear}
              stroke="#10b981"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{
                value: "FI",
                position: "insideTopRight",
                fill: "#10b981",
                fontSize: 10,
                offset: 6,
              }}
            />
          )}

          <Area
            type="monotone"
            dataKey="totalCapital"
            name="Total Capital"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#capGrad)"
            dot={false}
            activeDot={{ r: 4, fill: "#6366f1" }}
          />

          <Line
            type="monotone"
            dataKey="requiredCapital"
            name="Required for FI"
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 3, fill: "#f59e0b" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
