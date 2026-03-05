import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../index";
import {
  userProfiles,
  children,
  investmentAccounts,
  realEstateProperties,
  insurancePolicies,
  carryPositions,
  lpInvestments,
} from "../../db/schema";
import { eq } from "drizzle-orm";
import { calculateEstate } from "../../simulation/estate/calculator";
import { generateRecommendations } from "../../simulation/estate/recommendations";

export const estateRouter = createTRPCRouter({
  /**
   * Compute the full estate summary for the authenticated user:
   * gross estate, tax liability (federal + state), planning metrics,
   * and beneficiary allocations.
   */
  summary: protectedProcedure.query(async ({ ctx }) => {
    const uid = ctx.userId;
    const currentYear = new Date().getFullYear();

    const [
      profile,
      userChildren,
      accounts,
      properties,
      policies,
      carry,
      lp,
    ] = await Promise.all([
      ctx.db.query.userProfiles.findFirst({ where: eq(userProfiles.id, uid) }),
      ctx.db.query.children.findMany({ where: eq(children.userId, uid) }),
      ctx.db.query.investmentAccounts.findMany({ where: eq(investmentAccounts.userId, uid) }),
      ctx.db.query.realEstateProperties.findMany({ where: eq(realEstateProperties.userId, uid), with: { mortgage: true } }),
      ctx.db.query.insurancePolicies.findMany({ where: eq(insurancePolicies.userId, uid) }),
      ctx.db.query.carryPositions.findMany({ where: eq(carryPositions.userId, uid), with: { realizations: true } }),
      ctx.db.query.lpInvestments.findMany({ where: eq(lpInvestments.userId, uid) }),
    ]);

    if (!profile) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Profile not found. Please complete your profile setup.",
      });
    }

    const estateResult = calculateEstate({
      profile: {
        filingStatus: profile.filingStatus,
        stateOfResidence: profile.stateOfResidence,
        birthYear: profile.birthYear,
      },
      children: userChildren.map(c => ({
        id: c.id,
        name: c.name,
        birthYear: c.birthYear,
        inheritancePct: c.inheritancePct ?? 0,
      })),
      investmentAccounts: accounts.map(a => ({
        id: a.id,
        accountName: a.accountName,
        accountType: a.accountType,
        currentBalance: a.currentBalance,
      })),
      realEstate: properties.map(p => ({
        id: p.id,
        propertyName: p.propertyName,
        currentValue: p.currentValue,
        ownershipPct: p.ownershipPct,
        llcValuationDiscountPct: p.llcValuationDiscountPct ?? 0,
        mortgage: p.mortgage ? { outstandingBalance: p.mortgage.outstandingBalance } : null,
      })),
      insurance: policies.map(p => ({
        id: p.id,
        policyName: p.policyName,
        policyType: p.policyType,
        ownershipStructure: p.ownershipStructure,
        deathBenefit: p.deathBenefit,
        outstandingLoanBalance: p.outstandingLoanBalance ?? 0,
      })),
      carry: carry.map(c => {
        const sortedRealizations = [...(c.realizations ?? [])].sort((a, b) => a.year - b.year);
        return {
          id: c.id,
          fundName: c.fundName,
          expectedGrossCarry: c.expectedGrossCarry,
          haircutPct: c.haircutPct,
          expectedRealizationYear: sortedRealizations[0]?.year ?? currentYear,
        };
      }),
      lpInvestments: lp.map(l => ({
        id: l.id,
        fundName: l.fundName,
        currentNav: l.currentNav,
      })),
      currentYear,
    });

    return {
      ...estateResult,
      recommendations: generateRecommendations(estateResult),
    };
  }),
});
