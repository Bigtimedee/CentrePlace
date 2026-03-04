"use client";

import { useState, useCallback, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { NextSectionBanner } from "@/components/layout/next-section-banner";
import { Card, CardBody } from "@/components/ui/card";
import { ScenarioCard } from "@/components/scenarios/scenario-card";
import { ComparisonProjectionChart } from "@/components/scenarios/comparison-projection-chart";
import { ComparisonMetricsGrid } from "@/components/scenarios/comparison-metrics-grid";
import { ComparisonMilestoneTable } from "@/components/scenarios/comparison-milestone-table";
import { trpc } from "@/lib/trpc";
import type { ScenarioDefinition } from "@/server/simulation/engine/scenario-types";
import { SCENARIO_TEMPLATES, SCENARIO_COLORS } from "@/server/simulation/engine/scenario-types";
import Link from "next/link";

// ── Default scenario set ───────────────────────────────────────────────────────

const DEFAULT_SCENARIOS: ScenarioDefinition[] = SCENARIO_TEMPLATES.map((t, i) => ({
  id: `default_${i}`,
  name: t.name,
  color: t.color,
  overrides: t.overrides,
}));

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<ScenarioDefinition[]>(DEFAULT_SCENARIOS);

  // Single call: assembles base input + runs all scenario variants.
  // baseInput is returned alongside runs so no separate round-trip is needed.
  const { data: compareResult, isPending: isLoading, error, mutate: runScenarios } =
    trpc.scenarios.compareRun.useMutation();

  const baseInput = compareResult?.baseInput ?? null;
  const scenarioRuns = compareResult?.runs ?? null;

  useEffect(() => {
    runScenarios({ scenarios });
  }, [scenarios]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateScenario = useCallback((updated: ScenarioDefinition) => {
    setScenarios(prev => prev.map(s => (s.id === updated.id ? updated : s)));
  }, []);

  const removeScenario = useCallback((id: string) => {
    setScenarios(prev => prev.filter(s => s.id !== id));
  }, []);

  const addScenario = useCallback(() => {
    const usedColors = scenarios.map(s => s.color);
    const nextColor =
      SCENARIO_COLORS.find(c => !usedColors.includes(c)) ?? SCENARIO_COLORS[scenarios.length % SCENARIO_COLORS.length];
    const newScenario: ScenarioDefinition = {
      id: `custom_${Date.now()}`,
      name: `Scenario ${scenarios.length + 1}`,
      color: nextColor,
      overrides: {},
    };
    setScenarios(prev => [...prev, newScenario]);
  }, [scenarios]);

  const isProfileMissing = (error as { data?: { code?: string } } | null)?.data?.code === "PRECONDITION_FAILED";

  return (
    <div>
      <PageHeader
        title="Scenarios"
        description="Compare up to 3 scenarios with different return, spending, and carry assumptions"
      />

      <div className="mt-8 space-y-6">
        {/* Scenario control bar */}
        <Card>
          <CardBody>
            <p className="text-xs text-slate-500 mb-4">
              Each scenario runs a full 40-year simulation with your live data + any overrides you set below.
              Empty overrides = your live data as-is.
            </p>
            <div className="flex items-start gap-4 flex-wrap">
              {scenarios.map((scenario, idx) => (
                <ScenarioCard
                  key={scenario.id}
                  scenario={scenario}
                  isBase={idx === 0}
                  baseInput={baseInput ?? null}
                  onChange={updateScenario}
                  onRemove={() => removeScenario(scenario.id)}
                />
              ))}
              {scenarios.length < 3 && (
                <ScenarioCard isAddButton={true} onAdd={addScenario} />
              )}
            </div>
          </CardBody>
        </Card>

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-6 py-10 text-center text-sm text-slate-400">
            {isProfileMissing ? (
              <>
                <p className="mb-3">Complete your profile to run scenario comparisons.</p>
                <Link
                  href="/profile"
                  className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
                >
                  Go to Profile →
                </Link>
              </>
            ) : (
              <p>Unable to run scenarios: {String((error as { message?: string })?.message ?? error)}</p>
            )}
          </div>
        )}

        {/* Loading state */}
        {isLoading && !error && (
          <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
            <svg className="animate-spin h-5 w-5 mr-3 text-indigo-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Running {scenarios.length} scenario{scenarios.length > 1 ? "s" : ""}…
          </div>
        )}

        {/* Results */}
        {scenarioRuns && scenarioRuns.length > 0 && (
          <>
            {/* Capital projection chart */}
            <Card>
              <CardBody>
                <ComparisonProjectionChart runs={scenarioRuns} />
              </CardBody>
            </Card>

            {/* Side-by-side metrics */}
            <Card>
              <CardBody>
                <ComparisonMetricsGrid runs={scenarioRuns} />
              </CardBody>
            </Card>

            {/* Milestone table */}
            <Card>
              <CardBody>
                <ComparisonMilestoneTable runs={scenarioRuns} />
              </CardBody>
            </Card>
          </>
        )}
      </div>
      <NextSectionBanner
        href="/forecast"
        label="Probability Forecast"
        description="500 Monte Carlo simulations showing the range of FI outcomes under market uncertainty"
      />
    </div>
  );
}
