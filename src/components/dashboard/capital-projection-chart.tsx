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
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-xs shadow-xl min-w-[160px]">
      <p className="text-slate-400 mb-2 font-medium">Year {label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4 mb-1">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="text-slate-100 font-semibold">{fmtM(entry.value)}</span>
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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Capital Projection</h3>
          <p className="text-xs text-slate-500 mt-0.5">Total capital vs required to reach FI</p>
        </div>
        {fiYear && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/50 border border-emerald-800 rounded-full px-3 py-1">
            FI: {result.fiDate?.quarter} {fiYear} · Age {result.fiAge}
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 16 }}>
          <defs>
            <linearGradient id="capGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

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
  );
}
