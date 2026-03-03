import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../index";
import { assembleSimInput } from "../../simulation/assembler";
import { runSimulation } from "../../simulation/engine/quarterly-engine";
import { applyScenarioOverrides } from "../../simulation/engine/scenario-types";
import type { ScenarioRun } from "../../simulation/engine/scenario-types";

// ── Zod schema for overrides ───────────────────────────────────────────────────

const ScenarioOverrideSchema = z.object({
  assumedReturnRate: z.number().min(0.01).max(0.20).optional(),
  targetAge: z.number().int().min(70).max(100).optional(),
  safeHarborElection: z.boolean().optional(),
  annualSalary: z.number().min(0).optional(),
  annualBonus: z.number().min(0).optional(),
  salaryGrowthRate: z.number().min(0).max(0.30).optional(),
  bonusGrowthRate: z.number().min(0).max(0.30).optional(),
  recurringSpendingMultiplier: z.number().min(0.1).max(3.0).optional(),
  carryHaircutMultiplier: z.number().min(0).max(3.0).optional(),
  forceInsuranceOwnership: z.enum(["personal", "ilit"]).nullable().optional(),
});

const ScenarioDefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  color: z.string().min(4).max(9),
  overrides: ScenarioOverrideSchema,
});

export const scenariosRouter = createTRPCRouter({
  /**
   * Return the user's base SimulationInput (without running the engine).
   * The client uses this to show "current" values as placeholder text in
   * the scenario editor, and can pass it back with overrides to compareRun.
   */
  getBaseInput: protectedProcedure.query(async ({ ctx }) => {
    return assembleSimInput(ctx);
  }),

  /**
   * Run up to 3 scenarios in a single request.
   * The base SimulationInput is assembled once from the DB, then each
   * scenario's overrides are applied and runSimulation() is called N times.
   */
  compareRun: protectedProcedure
    .input(
      z.object({
        scenarios: z.array(ScenarioDefSchema).min(1).max(3),
      }),
    )
    .query(async ({ ctx, input }): Promise<ScenarioRun[]> => {
      const baseInput = await assembleSimInput(ctx);

      return input.scenarios.map(scenario => {
        const variantInput = applyScenarioOverrides(baseInput, scenario.overrides);
        const result = runSimulation(variantInput);
        return {
          scenarioId: scenario.id,
          name: scenario.name,
          color: scenario.color,
          result,
        };
      });
    }),
});
