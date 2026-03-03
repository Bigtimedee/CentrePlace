"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { MonteCarloResult } from "@/server/simulation/engine/monte-carlo-types";

type ProbRow = {
  year: number;
  pctFI100: number;
};

function buildData(result: MonteCarloResult): ProbRow[] {
  return result.bands.map(b => ({
    year: b.year,
    pctFI100: Math.round(b.pctFI * 1000) / 10,
  }));
}

interface Props {
  result: MonteCarloResult;
}

export function FiProbabilityChart({ result }: Props) {
  const data = buildData(result);
  const p50Year = result.bands.find(b => b.pctFI >= 0.5)?.year;
  const p75Year = result.bands.find(b => b.pctFI >= 0.75)?.year;
  const p90Year = result.bands.find(b => b.pctFI >= 0.9)?.year;

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-100">Cumulative FI Probability</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Fraction of simulated paths that have reached FI by each year
        </p>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 16 }}>
          <defs>
            <linearGradient id="probGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.20} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
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
            domain={[0, 100]}
            tickFormatter={v => `${v}%`}
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            formatter={(value: number | undefined) => [value != null ? `${value.toFixed(1)}%` : "—", "FI probability"]}
            labelFormatter={(label) => `Year ${label}`}
            contentStyle={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#94a3b8" }}
          />

          <ReferenceLine y={50} stroke="#64748b" strokeDasharray="4 3" strokeOpacity={0.6}
            label={{ value: "50%", position: "right", fill: "#64748b", fontSize: 10 }} />
          <ReferenceLine y={75} stroke="#64748b" strokeDasharray="4 3" strokeOpacity={0.6}
            label={{ value: "75%", position: "right", fill: "#64748b", fontSize: 10 }} />
          <ReferenceLine y={90} stroke="#64748b" strokeDasharray="4 3" strokeOpacity={0.6}
            label={{ value: "90%", position: "right", fill: "#64748b", fontSize: 10 }} />

          {p50Year && (
            <ReferenceLine
              x={p50Year}
              stroke="#10b981"
              strokeDasharray="4 3"
              strokeOpacity={0.7}
              label={{ value: "P50", position: "insideTopRight", fill: "#10b981", fontSize: 9 }}
            />
          )}
          {p75Year && p75Year !== p50Year && (
            <ReferenceLine
              x={p75Year}
              stroke="#6366f1"
              strokeDasharray="4 3"
              strokeOpacity={0.7}
              label={{ value: "P75", position: "insideTopRight", fill: "#6366f1", fontSize: 9 }}
            />
          )}
          {p90Year && p90Year !== p75Year && (
            <ReferenceLine
              x={p90Year}
              stroke="#f59e0b"
              strokeDasharray="4 3"
              strokeOpacity={0.7}
              label={{ value: "P90", position: "insideTopRight", fill: "#f59e0b", fontSize: 9 }}
            />
          )}

          <Area
            type="monotone"
            dataKey="pctFI100"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#probGrad)"
            dot={false}
            name="FI probability"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
