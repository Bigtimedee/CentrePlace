// ─────────────────────────────────────────────────────────────────────────────
// Scenario Comparison Types
// ─────────────────────────────────────────────────────────────────────────────
//
// A "scenario" is a named set of overrides applied on top of the user's live
// SimulationInput. The override object contains only the fields that deviate
// from the base; empty overrides = "Base" scenario (user's live data as-is).
// ─────────────────────────────────────────────────────────────────────────────

import type { SimulationInput, SimulationResult } from "./types";

// ── Override shape ─────────────────────────────────────────────────────────────

export interface ScenarioOverride {
  // Profile
  assumedReturnRate?: number;          // e.g. 0.05 (bear) / 0.09 (bull)
  targetAge?: number;                  // e.g. 85 vs 95
  safeHarborElection?: boolean;

  // Income
  annualSalary?: number;
  annualBonus?: number;
  salaryGrowthRate?: number;
  bonusGrowthRate?: number;

  // Spending: global multiplier applied to all recurring expenditures
  // 0.8 = 20% less spending,  1.2 = 20% more spending
  recurringSpendingMultiplier?: number;

  // Carry: multiplier applied to each haircutPct (clamped to [0, 1])
  // 0.5 = half the haircut (optimistic), 1.5 = 50% more haircut (pessimistic)
  carryHaircutMultiplier?: number;

  // Insurance: force all policies to "ilit" or "personal", or leave as-is (null)
  forceInsuranceOwnership?: "personal" | "ilit" | null;
}

// ── Scenario definition ────────────────────────────────────────────────────────

export interface ScenarioDefinition {
  id: string;
  name: string;
  color: string;      // hex color for chart rendering
  overrides: ScenarioOverride;
}

export interface ScenarioRun {
  scenarioId: string;
  name: string;
  color: string;
  result: SimulationResult;
}

// ── Pre-built templates ────────────────────────────────────────────────────────

export const SCENARIO_TEMPLATES: Array<Omit<ScenarioDefinition, "id">> = [
  {
    name: "Base",
    color: "#6366f1",
    overrides: {},
  },
  {
    name: "Bear Case",
    color: "#f43f5e",
    overrides: {
      assumedReturnRate: 0.05,
      recurringSpendingMultiplier: 1.1,
      carryHaircutMultiplier: 1.5,
    },
  },
  {
    name: "Bull Case",
    color: "#10b981",
    overrides: {
      assumedReturnRate: 0.09,
      recurringSpendingMultiplier: 0.9,
      carryHaircutMultiplier: 0.5,
    },
  },
];

// ── Color palette for user-created scenarios ──────────────────────────────────

export const SCENARIO_COLORS = [
  "#6366f1", // indigo
  "#f43f5e", // rose
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // violet
];

// ── applyScenarioOverrides ─────────────────────────────────────────────────────

/**
 * Produce a new SimulationInput by applying overrides to a base input.
 * The base input is NOT mutated — all objects are shallow-cloned.
 */
export function applyScenarioOverrides(
  base: SimulationInput,
  overrides: ScenarioOverride,
): SimulationInput {
  return {
    ...base,

    profile: {
      ...base.profile,
      ...(overrides.assumedReturnRate !== undefined && {
        assumedReturnRate: overrides.assumedReturnRate,
      }),
      ...(overrides.targetAge !== undefined && {
        targetAge: overrides.targetAge,
      }),
      ...(overrides.safeHarborElection !== undefined && {
        safeHarborElection: overrides.safeHarborElection,
      }),
    },

    income: base.income
      ? {
          ...base.income,
          ...(overrides.annualSalary !== undefined && { annualSalary: overrides.annualSalary }),
          ...(overrides.annualBonus !== undefined && { annualBonus: overrides.annualBonus }),
          ...(overrides.salaryGrowthRate !== undefined && {
            salaryGrowthRate: overrides.salaryGrowthRate,
          }),
          ...(overrides.bonusGrowthRate !== undefined && {
            bonusGrowthRate: overrides.bonusGrowthRate,
          }),
        }
      : null,

    recurringExpenditures:
      overrides.recurringSpendingMultiplier !== undefined
        ? base.recurringExpenditures.map(e => ({
            ...e,
            annualAmount: e.annualAmount * overrides.recurringSpendingMultiplier!,
          }))
        : base.recurringExpenditures,

    // When assumedReturnRate is overridden, also update every account's
    // blendedReturnRate so that capital actually grows at the scenario rate.
    // Without this, the override only affects the FI threshold formula
    // (requiredCapital = spending / rate) but not real portfolio growth.
    investmentAccounts:
      overrides.assumedReturnRate !== undefined
        ? base.investmentAccounts.map(a => ({
            ...a,
            blendedReturnRate: overrides.assumedReturnRate!,
          }))
        : base.investmentAccounts,

    carry:
      overrides.carryHaircutMultiplier !== undefined
        ? base.carry.map(c => ({
            ...c,
            haircutPct: Math.min(1, Math.max(0, c.haircutPct * overrides.carryHaircutMultiplier!)),
          }))
        : base.carry,

    insurance:
      overrides.forceInsuranceOwnership != null
        ? base.insurance.map(p => ({
            ...p,
            ownershipStructure: overrides.forceInsuranceOwnership as "personal" | "ilit",
          }))
        : base.insurance,
  };
}
