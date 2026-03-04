import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../index";
import { realizationPolicy } from "../../db/schema";
import { eq } from "drizzle-orm";

const policyShape = z.object({
  equityPct: z.number().min(0).max(1),
  equityAppreciationRate: z.number().min(0).max(0.30),
  equityQualifiedYieldRate: z.number().min(0).max(0.15),
  taxableFixedIncomePct: z.number().min(0).max(1),
  taxableFixedIncomeRate: z.number().min(0).max(0.20),
  taxExemptFixedIncomePct: z.number().min(0).max(1),
  taxExemptFixedIncomeRate: z.number().min(0).max(0.15),
  realEstatePct: z.number().min(0).max(1),
  reAppreciationRate: z.number().min(0).max(0.20),
  reGrossYieldRate: z.number().min(0).max(0.20),
  reCarryingCostRate: z.number().min(0).max(0.10),
});

export const realizationPolicyRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    const result = await ctx.db.query.realizationPolicy.findFirst({
      where: eq(realizationPolicy.userId, ctx.userId),
    });
    return result ?? null;
  }),

  upsert: protectedProcedure
    .input(policyShape)
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(realizationPolicy)
        .values({ userId: ctx.userId, ...input, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: realizationPolicy.userId,
          set: { ...input, updatedAt: new Date() },
        });
    }),

  delete: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.delete(realizationPolicy).where(eq(realizationPolicy.userId, ctx.userId));
  }),
});
