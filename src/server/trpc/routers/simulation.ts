import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../index";
import {
  incomeProfiles,
  investmentAccounts,
  realEstateProperties,
  mortgages,
  insurancePolicies,
  expenditures,
  userProfiles,
} from "../../db/schema";
import { eq } from "drizzle-orm";
import { runSimulation } from "../../simulation/engine/quarterly-engine";
import { runMonteCarlo } from "../../simulation/engine/monte-carlo";
import { optimizeWithdrawals } from "../../simulation/engine/withdrawal-optimizer";
import { computeAnnualSpending, computePermanentAnnualIncome } from "../../simulation/engine/fi-calculator";
import { assembleSimInput } from "../../simulation/assembler";
import type { SimRealEstateProperty, SimRecurringExpenditure } from "../../simulation/engine/types";

export const simulationRouter = createTRPCRouter({
  /**
   * Run the full 160-quarter simulation for the authenticated user.
   * Assembles all data from the DB and returns SimulationResult.
   */
  run: protectedProcedure.query(async ({ ctx }) => {
    const simInput = await assembleSimInput(ctx);
    return runSimulation(simInput);
  }),

  /**
   * Compute the tax-optimized withdrawal plan for the current year.
   * Shows recommended sequencing across account types (PPLI → WL → Roth → Taxable → Traditional).
   */
  withdrawalPlan: protectedProcedure.query(async ({ ctx }) => {
    const uid = ctx.userId;
    const currentYear = new Date().getFullYear();

    const [profile, income, accounts, properties, allMortgages, policies, recurring] =
      await Promise.all([
        ctx.db.query.userProfiles.findFirst({ where: eq(userProfiles.id, uid) }),
        ctx.db.query.incomeProfiles.findFirst({ where: eq(incomeProfiles.userId, uid) }),
        ctx.db.query.investmentAccounts.findMany({ where: eq(investmentAccounts.userId, uid) }),
        ctx.db.query.realEstateProperties.findMany({ where: eq(realEstateProperties.userId, uid) }),
        ctx.db.query.mortgages.findMany(),
        ctx.db.query.insurancePolicies.findMany({ where: eq(insurancePolicies.userId, uid) }),
        ctx.db.query.expenditures.findMany({ where: eq(expenditures.userId, uid) }),
      ]);

    if (!profile) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Profile not found. Please complete your profile setup.",
      });
    }

    const mortgageByPropertyId = new Map(allMortgages.map(m => [m.propertyId, m]));

    const simRealEstate: SimRealEstateProperty[] = properties.map(p => {
      const m = mortgageByPropertyId.get(p.id);
      return {
        id: p.id,
        propertyName: p.propertyName,
        propertyType: p.propertyType,
        currentValue: p.currentValue,
        purchasePrice: p.purchasePrice,
        purchaseYear: p.purchaseYear,
        appreciationRate: p.appreciationRate,
        ownershipPct: p.ownershipPct,
        llcValuationDiscountPct: p.llcValuationDiscountPct ?? 0,
        annualRentalIncome: p.annualRentalIncome ?? 0,
        annualOperatingExpenses: p.annualOperatingExpenses ?? 0,
        projectedSaleYear: p.projectedSaleYear ?? null,
        projectedSaleQuarter: (p.projectedSaleQuarter ?? null) as "Q1" | "Q2" | "Q3" | "Q4" | null,
        is1031Exchange: p.is1031Exchange,
        mortgage: m
          ? {
              outstandingBalance: m.outstandingBalance,
              interestRate: m.interestRate,
              remainingTermMonths: m.remainingTermMonths,
            }
          : null,
      };
    });

    const simRecurring: SimRecurringExpenditure[] = recurring.map(e => ({
      description: e.description,
      annualAmount: e.annualAmount,
      growthRate: e.growthRate,
    }));

    const annualSpending = computeAnnualSpending(simRecurring, currentYear, currentYear);
    const permanentIncome = computePermanentAnnualIncome(simRealEstate);
    const netSpendingNeed = Math.max(0, annualSpending - permanentIncome);

    const existingOrdinaryIncome = income
      ? income.annualSalary + income.annualBonus
      : 0;

    const currentAge = currentYear - profile.birthYear;

    return optimizeWithdrawals({
      annualSpendingNeed: netSpendingNeed,
      existingOrdinaryIncome,
      accounts: accounts.map(a => ({
        id: a.id,
        accountName: a.accountName,
        accountType: a.accountType,
        currentBalance: a.currentBalance,
        costBasisPct: 0.50,
      })),
      insurance: policies
        .filter(p => p.policyType === "whole_life" || p.policyType === "ppli")
        .map(p => ({
          id: p.id,
          policyName: p.policyName,
          policyType: p.policyType as "whole_life" | "ppli",
          cashValue: p.currentCashValue ?? 0,
          outstandingLoan: p.outstandingLoanBalance ?? 0,
          maxLoanPct: p.maxLoanPct ?? 0.9,
        })),
      filingStatus: profile.filingStatus,
      stateCode: profile.stateOfResidence,
      age: currentAge,
      year: currentYear,
    });
  }),

  /**
   * Run 500 Monte Carlo simulations to produce a probabilistic FI forecast.
   * Returns annual capital bands (p10–p90) and FI probability crossings.
   */
  monteCarlo: protectedProcedure
    .input(
      z.object({
        returnVolatility: z.number().min(0.01).max(0.50).default(0.12),
        varyCarryHaircut: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      const simInput = await assembleSimInput(ctx);
      const deterministicResult = runSimulation(simInput);
      return runMonteCarlo(simInput, deterministicResult, {
        simulations: 500,
        returnVolatility: input.returnVolatility,
        varyCarryHaircut: input.varyCarryHaircut,
      });
    }),
});
