"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency, formatPct } from "@/lib/utils";
import type { ScenarioRun } from "@/server/simulation/engine/scenario-types";

interface Props {
  runs: ScenarioRun[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function inferReturnRate(run: ScenarioRun): number {
  const { projectedAnnualSpending, permanentAnnualIncome, requiredCapitalToday } = run.result.summary;
  const netNeed = projectedAnnualSpending - permanentAnnualIncome;
  if (requiredCapitalToday <= 0 || netNeed <= 0) return 0;
  return netNeed / requiredCapitalToday;
}

/** Find the quarter closest to FI (highest % funded) for runs that never achieve FI */
function closestFIQuarter(run: ScenarioRun) {
  const req = run.result.summary.requiredCapitalToday;
  if (run.result.fiDate || req <= 0) return null;
  let best = run.result.quarters[0];
  for (const q of run.result.quarters) {
    if (q.totalCapital / req > best.totalCapital / req) best = q;
  }
  return best;
}

// ── Row component ─────────────────────────────────────────────────────────────

function LabelRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-baseline gap-4 py-1.5 border-b border-slate-800/60 last:border-b-0">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className="text-xs font-mono text-slate-200 text-right">{children}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mt-4 mb-1">
      {children}
    </p>
  );
}

// ── Scenario column ───────────────────────────────────────────────────────────

function ScenarioBreakdown({ run }: { run: ScenarioRun }) {
  const { summary, quarters } = run.result;
  const q0 = quarters[0];
  const returnRate = inferReturnRate(run);
  const netNeed = summary.projectedAnnualSpending - summary.permanentAnnualIncome;
  const pctFunded = summary.requiredCapitalToday > 0
    ? summary.totalCapitalToday / summary.requiredCapitalToday
    : 1;

  const best = closestFIQuarter(run);

  return (
    <div className="flex-1 min-w-0 border border-slate-800 rounded-xl p-4 bg-slate-900/50">
      {/* Scenario name */}
      <p className="text-xs font-bold mb-3" style={{ color: run.color }}>{run.name}</p>

      {/* FI Perpetuity Formula */}
      <SectionTitle>FI Formula (Perpetuity)</SectionTitle>
      <div className="rounded-lg bg-slate-800/60 border border-slate-700/50 px-3 py-2.5 mb-1 space-y-1">
        <p className="text-xs text-slate-400 leading-relaxed">
          Required Capital = (Annual Spending − Permanent Income) ÷ Return Rate
        </p>
        <p className="text-xs font-mono text-indigo-300 leading-relaxed">
          {formatCurrency(summary.requiredCapitalToday, true)} = (
          {formatCurrency(summary.projectedAnnualSpending, true)} −{" "}
          {formatCurrency(summary.permanentAnnualIncome, true)}) ÷{" "}
          {returnRate > 0 ? `${(returnRate * 100).toFixed(1)}%` : "N/A"}
        </p>
        <p className="text-xs text-slate-500 leading-relaxed">
          Net annual need: {formatCurrency(netNeed, true)} ÷{" "}
          {returnRate > 0 ? `${(returnRate * 100).toFixed(1)}%` : "—"} ={" "}
          {formatCurrency(summary.requiredCapitalToday, true)} required
        </p>
      </div>

      {/* Capital today breakdown */}
      <SectionTitle>Capital Today — Components</SectionTitle>
      <LabelRow label="Investment Accounts">{formatCurrency(q0.investmentCapital, true)}</LabelRow>
      {q0.unrealizedCarry > 0 && (
        <LabelRow label="Unrealized Carry (net)">{formatCurrency(q0.unrealizedCarry, true)}</LabelRow>
      )}
      {q0.realEstateEquity > 0 && (
        <LabelRow label="Real Estate Equity">{formatCurrency(q0.realEstateEquity, true)}</LabelRow>
      )}
      {q0.insuranceCashValue > 0 && (
        <LabelRow label="Insurance Cash Value">{formatCurrency(q0.insuranceCashValue, true)}</LabelRow>
      )}
      {q0.realizationCapital > 0 && (
        <LabelRow label="Realization Pool">{formatCurrency(q0.realizationCapital, true)}</LabelRow>
      )}
      <LabelRow label="Total Capital">
        <span className="text-slate-100 font-bold">{formatCurrency(summary.totalCapitalToday, true)}</span>
      </LabelRow>

      {/* Gap */}
      <SectionTitle>Gap Analysis</SectionTitle>
      <LabelRow label="Required for FI">{formatCurrency(summary.requiredCapitalToday, true)}</LabelRow>
      <LabelRow label="Capital Today">{formatCurrency(summary.totalCapitalToday, true)}</LabelRow>
      <LabelRow label="Gap">
        {summary.gapToFI <= 0
          ? <span className="text-emerald-400 font-bold">Already FI ✓</span>
          : <span className="text-rose-400 font-bold">{formatCurrency(summary.gapToFI, true)} short</span>
        }
      </LabelRow>
      <LabelRow label="% Funded">{formatPct(Math.min(1, pctFunded))}</LabelRow>

      {/* Bear / never-FI callout */}
      {!run.result.fiDate && best && (
        <>
          <SectionTitle>Closest Approach Within 40 Years</SectionTitle>
          <div className="rounded-lg bg-amber-900/20 border border-amber-700/40 px-3 py-2.5 text-xs text-amber-300 space-y-1 leading-relaxed">
            <p>
              FI is not achieved within the 40-year window. At these assumptions, the required
              capital ({formatCurrency(summary.requiredCapitalToday, true)}) exceeds what the
              portfolio can accumulate after taxes and spending.
            </p>
            <p>
              <span className="font-semibold">Closest point:</span>{" "}
              {best.quarterLabel} {best.year} (age {best.age}) —{" "}
              {formatCurrency(best.totalCapital, true)} /{" "}
              {formatCurrency(summary.requiredCapitalToday, true)} ={" "}
              {formatPct(best.totalCapital / summary.requiredCapitalToday)} funded
            </p>
            <p className="text-amber-400/80">
              To achieve FI under these assumptions: reduce annual spending, increase savings rate,
              or accept a higher carry realization (lower haircut).
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ComparisonFIBreakdown({ runs }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900">
      {/* Header / toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
      >
        <div>
          <p className="text-sm font-semibold text-slate-100">FI Formula Breakdown</p>
          <p className="text-xs text-slate-500 mt-0.5">
            See the math behind each scenario — how Required Capital is computed and where your
            capital stands today
          </p>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0" />
          : <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
        }
      </button>

      {open && (
        <div className="px-6 pb-6 border-t border-slate-800">
          {/* Legend */}
          <div className="rounded-lg bg-slate-800/40 border border-slate-700/40 px-4 py-3 mt-4 mb-5 text-xs text-slate-400 space-y-1 leading-relaxed">
            <p>
              <span className="text-slate-200 font-medium">How the FI target is set: </span>
              Financial Independence is achieved when your invested capital can generate enough
              annual return to cover your spending — indefinitely, without drawing down principal.
              This is the <span className="text-indigo-400">perpetuity formula</span>.
            </p>
            <p>
              <span className="text-slate-200 font-medium">Key levers: </span>
              Lower spending reduces the numerator; higher return rate increases the denominator.
              Either shrinks Required Capital. Permanent rental income is subtracted before dividing,
              so every $1 of net rental income reduces required capital by $1 ÷ Return Rate
              (e.g., $1 of rental at 7% = $14 less capital needed).
            </p>
          </div>

          <div className="flex gap-4 flex-wrap">
            {runs.map(run => (
              <ScenarioBreakdown key={run.scenarioId} run={run} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
