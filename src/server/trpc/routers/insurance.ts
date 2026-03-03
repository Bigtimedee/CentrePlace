import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../index";
import { insurancePolicies } from "../../db/schema";
import { eq, and } from "drizzle-orm";

const policyInput = z.object({
  policyName: z.string().min(1),
  policyType: z.enum(["term", "whole_life", "ppli"]),
  ownershipStructure: z.enum(["personal", "ilit"]),
  insurer: z.string().optional(),
  deathBenefit: z.number().min(0),
  annualPremium: z.number().min(0),
  premiumYearsRemaining: z.number().int().min(0),
  currentCashValue: z.number().min(0).optional(),
  assumedReturnRate: z.number().min(0).max(0.3).optional(),
  outstandingLoanBalance: z.number().min(0).optional(),
  maxLoanPct: z.number().min(0).max(1).optional(),
  ppliUnderlyingAllocation: z.string().optional(),
  isEstateTaxFunding: z.boolean(),
});

export const insuranceRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.insurancePolicies.findMany({
      where: eq(insurancePolicies.userId, ctx.userId),
      orderBy: (p, { asc }) => [asc(p.policyType)],
    });
  }),

  add: protectedProcedure
    .input(policyInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.insert(insurancePolicies).values({ userId: ctx.userId, ...input }).returning();
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(policyInput.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await ctx.db.update(insurancePolicies)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(insurancePolicies.id, id), eq(insurancePolicies.userId, ctx.userId)));
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(insurancePolicies)
        .where(and(eq(insurancePolicies.id, input.id), eq(insurancePolicies.userId, ctx.userId)));
    }),
});
