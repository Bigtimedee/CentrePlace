"use client";

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { MonteCarloResult } from "@/server/simulation/engine/monte-carlo-types";

function fmtM(value: number) {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

type ChartRow = {
  year: number;
  p10: number;
  d_p10_p25: number;
  d_p25_p75: number;
  d_p75_p90: number;
  p50: number;
  base: number;
  requiredCapital: number;
  pctFI: number;
};

function buildData(result: MonteCarloResult): ChartRow[] {
  return result.bands.map(b => ({
    year: b.year,
    p10: b.p10,
    d_p10_p25: b.p25 - b.p10,
    d_p25_p75: b.p75 - b.p25,
    d_p75_p90: b.p90 - b.p75,
    p50: b.p50,
    base: b.base,
    requiredCapital: b.requiredCapital,
    pctFI: b.pctFI,
  }));
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number }>;
  label?: number;
}) {
  if (!active || !payload?.length) return null;

  const find = (key: string) => payload.find(p => p.dataKey === key)?.value ?? 0;
  const p10 = find("p10");
  const d1025 = find("d_p10_p25");
  const d2575 = find("d_p25_p75");
  const d7590 = find("d_p75_p90");
  const p25 = p10 + d1025;
  const p75 = p25 + d2575;
  const p90 = p75 + d7590;
  const p50 = find("p50");
  const pctFI = find("pctFI");

  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs shadow-xl min-w-[180px]">
      <p className="text-slate-500 mb-2 font-medium">Year {label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">P90</span>
          <span className="text-slate-900">{fmtM(p90)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">P75</span>
          <span className="text-slate-900">{fmtM(p75)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-indigo-600 font-medium">P50</span>
          <span className="text-indigo-600 font-medium">{fmtM(p50)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">P25</span>
          <span className="text-slate-900">{fmtM(p25)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-500">P10</span>
          <span className="text-slate-900">{fmtM(p10)}</span>
        </div>
        <div className="flex justify-between gap-4 pt-1 border-t border-slate-200">
          <span className="text-emerald-500">FI paths</span>
          <span className="text-emerald-600">{Math.round(pctFI * 100)}%</span>
        </div>
      </div>
    </div>
  );
}

interface Props {
  result: MonteCarloResult;
}

export function MonteCarloChart({ result }: Props) {
  const data = buildData(result);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Capital Fan — 500 Simulated Paths</h3>
          <p className="text-xs text-slate-600 mt-0.5">Shaded bands show P10–P90 range; line is median path</p>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-2 rounded" style={{ background: "#6366f1", opacity: 0.5 }} />
            P25–P75
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-indigo-500" />
            Median
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-slate-400 border-dashed" />
            Base case
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-amber-600 border-dashed" />
            Required
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 16 }}>
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

          {/* Fan: stacked areas representing P10–P90 band */}
          <Area type="monotone" dataKey="p10"       stackId="fan" fill="transparent" stroke="none" legendType="none" />
          <Area type="monotone" dataKey="d_p10_p25" stackId="fan" fill="#6366f1" fillOpacity={0.12} stroke="none" legendType="none" />
          <Area type="monotone" dataKey="d_p25_p75" stackId="fan" fill="#6366f1" fillOpacity={0.22} stroke="none" legendType="none" />
          <Area type="monotone" dataKey="d_p75_p90" stackId="fan" fill="#6366f1" fillOpacity={0.12} stroke="none" legendType="none" />

          {/* Lines */}
          <Line type="monotone" dataKey="p50"             stroke="#6366f1" strokeWidth={2}   dot={false} name="Median" />
          <Line type="monotone" dataKey="base"            stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="Base case" />
          <Line type="monotone" dataKey="requiredCapital" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 4" dot={false} name="Required for FI" />

          {result.deterministicFiYear && (
            <ReferenceLine
              x={result.deterministicFiYear}
              stroke="#10b981"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{
                value: "Base FI",
                position: "insideTopRight",
                fill: "#10b981",
                fontSize: 10,
                offset: 4,
              }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
