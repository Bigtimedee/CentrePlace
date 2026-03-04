import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../index";
import { assembleSimInput } from "../../simulation/assembler";
import { runSimulation } from "../../simulation/engine/quarterly-engine";
import { calculateEstate } from "../../simulation/estate/calculator";
import { generateRecommendations } from "../../simulation/estate/recommendations";
import { buildLiquidityTimeline } from "../../simulation/cashflow/timeline-builder";
import { computeActionPlan } from "../../simulation/plan/action-plan";
import {
  children,
  insurancePolicies,
  userProfiles,
  investmentAccounts,
  realEstateProperties,
  mortgages,
  carryPositions,
  lpInvestments,
} from "../../db/schema";
import { eq } from "drizzle-orm";
import type { AnnualActionPlanResult } from "../../simulation/plan/types";

export const planRouter = createTRPCRouter({
  /**
   * Compute the annual action plan: cross-module synthesis of tax, estate,
   * carry, LP, and FI data into a ranked ActionItem list for the current year.
   */
  annual: protectedProcedure.query(async ({ ctx }): Promise<AnnualActionPlanResult> => {
    const uid = ctx.userId;
    const planYear = new Date().getFullYear();

    // Assemble sim input + supplementary estate data in parallel
    const [simInput, userChildren, rawPolicies] = await Promise.all([
      assembleSimInput(ctx),
      ctx.db.query.children.findMany({ where: eq(children.userId, uid) }),
      ctx.db.query.insurancePolicies.findMany({ where: eq(insurancePolicies.userId, uid) }),
    ]);

    // Run simulation
    const simResult = runSimulation(simInput);

    // Find current-year Q4 result (or use first Q4 as fallback)
    const currentYearQ4 =
      simResult.quarters.find(q => q.year === planYear && q.quarterLabel === "Q4") ??
      simResult.quarters[3];

    // Compute estate
    const estateResult = calculateEstate({
      profile: {
        filingStatus: simInput.profile.filingStatus,
        stateOfResidence: simInput.profile.stateOfResidence,
        birthYear: simInput.profile.birthYear,
      },
      children: userChildren.map(c => ({
        id: c.id,
        name: c.name,
        birthYear: c.birthYear,
        inheritancePct: c.inheritancePct ?? 0,
      })),
      investmentAccounts: simInput.investmentAccounts.map(a => ({
        id: a.id,
        accountName: a.accountName,
        accountType: a.accountType,
        currentBalance: a.currentBalance,
      })),
      realEstate: simInput.realEstate.map(p => ({
        id: p.id,
        propertyName: p.propertyName,
        currentValue: p.currentValue,
        ownershipPct: p.ownershipPct,
        llcValuationDiscountPct: p.llcValuationDiscountPct ?? 0,
        mortgage: p.mortgage ? { outstandingBalance: p.mortgage.outstandingBalance } : null,
      })),
      insurance: rawPolicies.map(p => ({
        id: p.id,
        policyName: p.policyName,
        policyType: p.policyType,
        ownershipStructure: p.ownershipStructure,
        deathBenefit: p.deathBenefit,
        outstandingLoanBalance: p.outstandingLoanBalance ?? 0,
      })),
      carry: simInput.carry.map(c => {
        const sortedSchedule = [...c.realizationSchedule].sort((a, b) => a.year - b.year);
        return {
          id: c.id,
          fundName: c.fundName,
          expectedGrossCarry: c.expectedGrossCarry,
          haircutPct: c.haircutPct,
          expectedRealizationYear: sortedSchedule[0]?.year ?? new Date().getFullYear(),
        };
      }),
      lpInvestments: simInput.lpDistributions
        .reduce((acc, d) => {
          if (!acc.some(x => x.fundName === d.fundName)) {
            // Approximate NAV as sum of all distributions for this fund
            const nav = simInput.lpDistributions
              .filter(x => x.fundName === d.fundName)
              .reduce((s, x) => s + x.amount, 0);
            acc.push({ id: d.fundName, fundName: d.fundName, currentNav: nav });
          }
          return acc;
        }, [] as Array<{ id: string; fundName: string; currentNav: number }>),
      currentYear: planYear,
    });

    const recommendations = generateRecommendations(estateResult);

    // Build liquidity timeline
    const liquidity = buildLiquidityTimeline(simInput, planYear, planYear + 39);

    return computeActionPlan(
      planYear,
      simInput,
      simResult,
      currentYearQ4,
      { ...estateResult, recommendations },
      liquidity,
    );
  }),
});
