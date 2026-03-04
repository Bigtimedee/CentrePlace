// ─────────────────────────────────────────────────────────────────────────────
// SimulationInput Assembler
// ─────────────────────────────────────────────────────────────────────────────
//
// Shared helper used by both `simulation.run` and `scenarios.compareRun`.
// Fetches all user data from the DB and assembles a SimulationInput.
// ─────────────────────────────────────────────────────────────────────────────

import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import {
  userProfiles,
  children,
  incomeProfiles,
  carryPositions,
  lpInvestments,
  investmentAccounts,
  realEstateProperties,
  mortgages,
  insurancePolicies,
  expenditures,
  oneTimeExpenditures,
  realizationPolicy,
} from "../db/schema";
import type {
  SimulationInput,
  SimCarryPosition,
  SimLPDistribution,
  SimInvestmentAccount,
  SimRealEstateProperty,
  SimInsurancePolicy,
  SimRecurringExpenditure,
  SimOneTimeExpenditure,
  SimChildEducation,
  SimRealizationPolicy,
} from "./engine/types";
import type { Context } from "../trpc/context";

type ProtectedCtx = Context & { userId: string };

export async function assembleSimInput(ctx: ProtectedCtx): Promise<SimulationInput> {
  const uid = ctx.userId;

  const [
    profile,
    userChildren,
    income,
    carry,
    lp,
    accounts,
    properties,
    allMortgages,
    policies,
    recurring,
    oneTime,
    policy,
  ] = await Promise.all([
    ctx.db.query.userProfiles.findFirst({ where: eq(userProfiles.id, uid) }),
    ctx.db.query.children.findMany({ where: eq(children.userId, uid) }),
    ctx.db.query.incomeProfiles.findFirst({ where: eq(incomeProfiles.userId, uid) }),
    ctx.db.query.carryPositions.findMany({ where: eq(carryPositions.userId, uid), with: { realizations: true } }),
    ctx.db.query.lpInvestments.findMany({ where: eq(lpInvestments.userId, uid) }),
    ctx.db.query.investmentAccounts.findMany({ where: eq(investmentAccounts.userId, uid) }),
    ctx.db.query.realEstateProperties.findMany({ where: eq(realEstateProperties.userId, uid) }),
    ctx.db.query.mortgages.findMany(),
    ctx.db.query.insurancePolicies.findMany({ where: eq(insurancePolicies.userId, uid) }),
    ctx.db.query.expenditures.findMany({ where: eq(expenditures.userId, uid) }),
    ctx.db.query.oneTimeExpenditures.findMany({ where: eq(oneTimeExpenditures.userId, uid) }),
    ctx.db.query.realizationPolicy.findFirst({ where: eq(realizationPolicy.userId, uid) }),
  ]);

  if (!profile) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Profile not found. Please complete your profile setup before running a simulation.",
    });
  }

  const mortgageByPropertyId = new Map(allMortgages.map(m => [m.propertyId, m]));

  const simCarry: SimCarryPosition[] = carry.map(c => ({
    id: c.id,
    fundName: c.fundName,
    expectedGrossCarry: c.expectedGrossCarry,
    haircutPct: c.haircutPct,
    realizationSchedule: c.realizations.map(r => ({
      year: r.year,
      quarter: r.quarter as "Q1" | "Q2" | "Q3" | "Q4",
      pct: r.pct,
    })),
  }));

  const simLp: SimLPDistribution[] = lp.flatMap(fund =>
    (fund.expectedDistributions ?? []).map(d => ({
      fundName: fund.fundName,
      year: d.year,
      quarter: d.quarter,
      amount: d.amount,
      taxCharacter: d.taxCharacter,
    })),
  );

  const simAccounts: SimInvestmentAccount[] = accounts.map(a => ({
    id: a.id,
    accountName: a.accountName,
    accountType: a.accountType,
    currentBalance: a.currentBalance,
    blendedReturnRate:
      a.equityPct * a.equityReturnRate +
      a.bondPct * a.bondReturnRate +
      a.altPct * a.altReturnRate,
    annualContribution: a.annualContribution,
    ordinaryYieldRate: a.ordinaryYieldRate ?? 0,
    qualifiedYieldRate: a.qualifiedYieldRate ?? 0,
    taxExemptYieldRate: a.taxExemptYieldRate ?? 0,
  }));

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

  const simInsurance: SimInsurancePolicy[] = policies.map(p => ({
    id: p.id,
    policyType: p.policyType,
    ownershipStructure: p.ownershipStructure,
    deathBenefit: p.deathBenefit,
    annualPremium: p.annualPremium,
    premiumYearsRemaining: p.premiumYearsRemaining,
    currentCashValue: p.currentCashValue ?? 0,
    assumedReturnRate: p.assumedReturnRate ?? 0.05,
    outstandingLoanBalance: p.outstandingLoanBalance ?? 0,
    maxLoanPct: p.maxLoanPct ?? 0.9,
    isEstateTaxFunding: p.isEstateTaxFunding,
  }));

  const simRecurring: SimRecurringExpenditure[] = recurring.map(e => ({
    description: e.description,
    annualAmount: e.annualAmount,
    growthRate: e.growthRate,
  }));

  const simOneTime: SimOneTimeExpenditure[] = oneTime.map(e => ({
    description: e.description,
    amount: e.amount,
    projectedYear: e.projectedYear,
    projectedQuarter: e.projectedQuarter as "Q1" | "Q2" | "Q3" | "Q4",
  }));

  const simChildren: SimChildEducation[] = userChildren.map(c => ({
    name: c.name,
    birthYear: c.birthYear,
    annualK12Cost: c.k12TuitionCost ?? 0,
    hasCollege: c.educationType !== "none",
    annualCollegeCost: c.annualEducationCost ?? 0,
    hasGradSchool: c.includesGraduateSchool,
    annualGradSchoolCost: c.graduateSchoolCost ?? 0,
    gradSchoolYears: c.graduateSchoolYears ?? 0,
  }));

  const simPolicy: SimRealizationPolicy | null = policy
    ? {
        equityPct: policy.equityPct,
        equityAppreciationRate: policy.equityAppreciationRate,
        equityQualifiedYieldRate: policy.equityQualifiedYieldRate,
        taxableFixedIncomePct: policy.taxableFixedIncomePct,
        taxableFixedIncomeRate: policy.taxableFixedIncomeRate,
        taxExemptFixedIncomePct: policy.taxExemptFixedIncomePct,
        taxExemptFixedIncomeRate: policy.taxExemptFixedIncomeRate,
        realEstatePct: policy.realEstatePct,
        reAppreciationRate: policy.reAppreciationRate,
        reGrossYieldRate: policy.reGrossYieldRate,
        reCarryingCostRate: policy.reCarryingCostRate,
      }
    : null;

  return {
    profile: {
      filingStatus: profile.filingStatus,
      stateOfResidence: profile.stateOfResidence,
      birthYear: profile.birthYear,
      targetAge: profile.targetAge,
      assumedReturnRate: profile.assumedReturnRate,
      safeHarborElection: profile.safeHarborElection,
      postFIReturnRate: profile.postFIReturnRate,
    },
    income: income
      ? {
          annualSalary: income.annualSalary,
          annualBonus: income.annualBonus,
          salaryGrowthRate: income.salaryGrowthRate,
          bonusGrowthRate: income.bonusGrowthRate,
        }
      : null,
    carry: simCarry,
    lpDistributions: simLp,
    investmentAccounts: simAccounts,
    realEstate: simRealEstate,
    insurance: simInsurance,
    recurringExpenditures: simRecurring,
    oneTimeExpenditures: simOneTime,
    children: simChildren,
    realizationPolicy: simPolicy,
  };
}
