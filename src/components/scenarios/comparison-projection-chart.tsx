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
import type { ScenarioRun } from "@/server/simulation/engine/scenario-types";
import type { QuarterResult } from "@/server/simulation/engine/types";
import { EmptyState } from "@/components/ui/empty-state";

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtM(value: number) {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

// ── Data preparation ──────────────────────────────────────────────────────────

type ChartRow = Record<string, number>;

function buildChartData(runs: ScenarioRun[]): ChartRow[] {
  // Collect all unique years present in any scenario's Q4 snapshots
  const yearSet = new Set<number>();
  for (const run of runs) {
    run.result.quarters
      .filter((q: QuarterResult) => q.quarterLabel === "Q4")
      .forEach((q: QuarterResult) => yearSet.add(q.year));
  }
  const years = Array.from(yearSet).sort((a, b) => a - b);

  return years.map(year => {
    const row: ChartRow = { year };
    for (const run of runs) {
      const q = run.result.quarters.find(
        (qr: QuarterResult) => qr.year === year && qr.quarterLabel === "Q4",
      );
      if (q) {
        row[`${run.scenarioId}_capital`] = q.totalCapital;
        row[`${run.scenarioId}_required`] = q.requiredCapital;
      }
    }
    return row;
  });
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
  runs,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: number;
  runs: ScenarioRun[];
}) {
  if (!active || !payload?.length) return null;

  // Only show capital series (not required) to keep tooltip clean
  const capitalEntries = payload.filter(p => String(p.dataKey).endsWith("_capital"));

  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs shadow-xl min-w-[180px]">
      <p className="text-slate-500 mb-2 font-medium">Year {label}</p>
      {capitalEntries.map(entry => {
        const scenarioId = String(entry.dataKey).replace("_capital", "");
        const run = runs.find(r => r.scenarioId === scenarioId);
        return (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4 mb-1">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: run?.color ?? entry.color }}
              />
              <span style={{ color: run?.color }}>{run?.name ?? scenarioId}</span>
            </span>
            <span className="text-slate-900 font-semibold">{fmtM(entry.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  runs: ScenarioRun[];
}

export function ComparisonProjectionChart({ runs }: Props) {
  const data = buildChartData(runs);

  if (runs.length === 0) {
    return <EmptyState message="Add scenarios to compare projections." />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Capital Projection</h3>
          <p className="text-xs text-slate-600 mt-0.5">Total capital across scenarios</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {runs.map(run => (
            <div key={run.scenarioId} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: run.color }}
              />
              {run.name}
              {run.result.fiDate && (
                <span className="text-slate-600">
                  · FI {run.result.fiDate.year}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 16 }}>
          <defs>
            {runs.map(run => (
              <linearGradient key={run.scenarioId} id={`grad_${run.scenarioId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={run.color} stopOpacity={0.20} />
                <stop offset="95%" stopColor={run.color} stopOpacity={0.01} />
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

          <Tooltip content={<CustomTooltip runs={runs} />} />

          {/* FI reference lines */}
          {runs.map(run =>
            run.result.fiDate ? (
              <ReferenceLine
                key={`fi_${run.scenarioId}`}
                x={run.result.fiDate.year}
                stroke={run.color}
                strokeDasharray="4 3"
                strokeWidth={1}
                strokeOpacity={0.7}
                label={{
                  value: run.name.split(" ")[0],
                  position: "insideTopRight",
                  fill: run.color,
                  fontSize: 9,
                  offset: 4,
                }}
              />
            ) : null,
          )}

          {/* Capital area per scenario */}
          {runs.map(run => (
            <Area
              key={`cap_${run.scenarioId}`}
              type="monotone"
              dataKey={`${run.scenarioId}_capital`}
              name={run.name}
              stroke={run.color}
              strokeWidth={2}
              fill={`url(#grad_${run.scenarioId})`}
              dot={false}
              activeDot={{ r: 4, fill: run.color }}
            />
          ))}

          {/* Required capital dashed lines */}
          {runs.map(run => (
            <Line
              key={`req_${run.scenarioId}`}
              type="monotone"
              dataKey={`${run.scenarioId}_required`}
              name={`Required (${run.name})`}
              stroke={run.color}
              strokeWidth={1}
              strokeDasharray="5 4"
              strokeOpacity={0.40}
              dot={false}
              legendType="none"
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
