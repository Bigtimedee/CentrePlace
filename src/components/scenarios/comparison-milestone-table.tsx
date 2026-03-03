"use client";

import { formatCurrency } from "@/lib/utils";
import type { ScenarioRun } from "@/server/simulation/engine/scenario-types";
import type { QuarterResult } from "@/server/simulation/engine/types";

interface Props {
  runs: ScenarioRun[];
}

interface MilestoneRow {
  year: number;
  age: number;
  /** per scenario: [totalCapital, isFI] */
  byScenario: Array<{ capital: number; isFI: boolean }>;
}

// ── Data preparation ──────────────────────────────────────────────────────────

function buildMilestoneRows(runs: ScenarioRun[]): MilestoneRow[] {
  if (runs.length === 0) return [];

  const base = runs[0].result;
  const startYear = base.startYear;
  const endYear = startYear + 39;

  // Collect milestone years: every 5 years + FI years for all scenarios
  const milestoneYears = new Set<number>();
  for (let y = startYear; y <= endYear; y += 5) milestoneYears.add(y);
  for (const run of runs) {
    if (run.result.fiDate) milestoneYears.add(run.result.fiDate.year);
  }

  return Array.from(milestoneYears)
    .sort((a, b) => a - b)
    .map(year => {
      const q4ByScenario = runs.map(run =>
        run.result.quarters.find((q: QuarterResult) => q.year === year && q.quarterLabel === "Q4"),
      );

      const age = q4ByScenario[0]?.age ?? base.currentAge + (year - startYear);

      return {
        year,
        age,
        byScenario: runs.map((_run, i) => ({
          capital: q4ByScenario[i]?.totalCapital ?? 0,
          isFI: q4ByScenario[i]?.isFI ?? false,
        })),
      };
    });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ComparisonMilestoneTable({ runs }: Props) {
  const rows = buildMilestoneRows(runs);

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-100 mb-4">Milestone Snapshots</h3>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-800/40 border-b border-slate-800">
              <th className="text-left font-medium text-slate-500 px-4 py-2.5">Year</th>
              <th className="text-left font-medium text-slate-500 px-4 py-2.5">Age</th>
              {runs.map(run => (
                <th
                  key={run.scenarioId}
                  className="text-right font-semibold px-4 py-2.5"
                  style={{ color: run.color }}
                >
                  {run.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const anyFI = row.byScenario.some(s => s.isFI);
              return (
                <tr
                  key={row.year}
                  className={`border-b border-slate-800/60 last:border-b-0 transition-colors ${
                    anyFI ? "bg-emerald-950/10" : "hover:bg-slate-800/20"
                  }`}
                >
                  <td className="px-4 py-2.5 font-medium text-slate-300">{row.year}</td>
                  <td className="px-4 py-2.5 text-slate-400">{row.age}</td>
                  {row.byScenario.map((s, i) => (
                    <td
                      key={i}
                      className="px-4 py-2.5 text-right font-mono font-semibold"
                      style={s.isFI ? { color: runs[i].color } : undefined}
                    >
                      <span className={s.isFI ? "" : "text-slate-300"}>
                        {formatCurrency(s.capital, true)}
                      </span>
                      {s.isFI && (
                        <span
                          className="ml-1.5 text-[9px] rounded-full px-1.5 py-0.5 border font-normal"
                          style={{ color: runs[i].color, borderColor: runs[i].color + "40", backgroundColor: runs[i].color + "15" }}
                        >
                          FI
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
